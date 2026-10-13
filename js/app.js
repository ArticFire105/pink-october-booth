import { boundsOf, composePortrait } from "./photo-stickers.js";
import { portraitCrop, faceCentre } from "./portrait-crop.js";
import { createQuizAdvance } from "./quiz-advance.js";
import { PINK_QUIZ_QUESTIONS } from "./questions-bank.js";
import { pickQuestions } from "./quiz-round.js";
import { normalizeHeart, placeHeart } from "./heart-placement.js";
import { createFactBag } from "./awareness-facts.js";
import { acceptsHalf, halfCoverage } from "./team.js";
import { setupFinishEffects } from "./finish-effects.js";
import { setupBoothExtras } from "./booth-extras.js";
import { setupStats } from "./stats.js";
import { createResultScreen } from "./result.js";
import {
  HAND,
  PALM_CLEAR_MS,
  isOpenPalm,
  shouldClearCanvas,
  createEdgeHold,
  createPinchLatch,
  isHeartGesture,
  mapCoverPoint,
  pinchRatio,
  isThumbsUp,
} from "./gestures.js";
import { createIdleWatch, createPointFilter, shouldBreakStroke } from "./filters.js";
import { createDrawFinish } from "./draw-finish.js";
import { heartOutline, placeOutline, scoreHeartDrawing } from "./heart-score.js";
import { isCorrectChoice, scoreQuiz } from "./quiz.js";
import { TILT_ENTER_RAD, createTiltMachine, eyeLineFromLandmarks } from "./tilt.js";

const VISION_VERSION = "0.10.21";
const VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const CAMERA_KEY = "gdg-pink-october-camera";
const DETECT_GAP_MS = 33;
const IDLE_MS = 75000;
const DRAW_BEAT_MS = 1000;
const DRAW_LIMIT_MS = 22000;
const THUMBS_HOLD_MS = 500;
let thumbsSince = null;
// Unit-diagonal heart is ~0.67 tall and ~0.74 wide: ~65% of frame height, capped by width.
function heartGuideSize() { return Math.min(view.h * 0.97, view.w * 1.2); }
const HEART_HOLD_MS = 500;
const PHOTO_BEAT_MS = 1000;
const METER_SPAN = TILT_ENTER_RAD / 0.6;
const OUTLINE = heartOutline(80);

const home = document.querySelector("#home");
const stage = document.querySelector("#stage");
const backBtn = document.querySelector("#back-btn");
const fullBtn = document.querySelector("#full-btn");
const cameraSelect = document.querySelector("#camera-select");
const homeError = document.querySelector("#home-error");
const quizCount = document.querySelector("#quiz-count");
const quizCard = document.querySelector("#quiz-card");
const video = document.querySelector("#video");
const drawLayer = document.querySelector("#draw-layer");
const fxLayer = document.querySelector("#fx-layer");
const hintBar = document.querySelector("#hint-bar");
const hintText = document.querySelector("#hint-text");
const retryBtn = document.querySelector("#retry-btn");
const gate = document.querySelector("#gate");
const gateTitle = document.querySelector("#gate-title");
const gateText = document.querySelector("#gate-text");
const gateRetry = document.querySelector("#gate-retry");
const drawHud = document.querySelector("#draw-hud");
const drawCount = document.querySelector("#draw-count");
const drawTimer = document.querySelector("#draw-timer");
const drawActions = document.querySelector("#draw-actions");
const drawDone = document.querySelector("#draw-done");
const teamToggle = document.querySelector("#team-mode");
const teamCoverage = document.querySelector("#team-coverage");
const celebrateFinish = setupFinishEffects(document.querySelector("#mute"), document.querySelector("#finish-ribbon"));
const drawReset = document.querySelector("#draw-reset");
const cornerBadge = document.querySelector("#corner-badge");
const photoCount = document.querySelector("#photo-count");
const debugEl = document.querySelector("#debug");
const quiz = document.querySelector("#quiz");
const quizAsk = document.querySelector("#quiz-ask");
const quizProgress = document.querySelector("#quiz-progress");
const quizPrompt = document.querySelector("#quiz-prompt");
const quizNote = document.querySelector("#quiz-note");
const recenterBtn = document.querySelector("#recenter-btn");
const meter = document.querySelector("#meter");
const meterPuck = document.querySelector("#meter-puck");
const mythBtn = document.querySelector("#myth-btn");
const factBtn = document.querySelector("#fact-btn");
const mythHold = document.querySelector("#myth-hold");
const factHold = document.querySelector("#fact-hold");
const mythFill = document.querySelector("#myth-fill");
const factFill = document.querySelector("#fact-fill");
const quizReveal = document.querySelector("#quiz-reveal");
const verdict = document.querySelector("#verdict");
const truthLine = document.querySelector("#truth-line");
const explanation = document.querySelector("#explanation");
const nextBtn = document.querySelector("#next-btn");
const live = document.querySelector("#live");

const drawCtx = drawLayer.getContext("2d");
const fxCtx = fxLayer.getContext("2d");

const HINTS = {
  draw: "Pinch to trace · Close the heart or release to finish · Reset clears",
  heart: "Thumbs up to take photo",
};

const MODE_TITLE = {
  draw: "Draw Hope",
  heart: "Optional photo finish",
  quiz: "Myth or Fact",
};

const state = {
  mode: "home",
  entry: 0,
  questions: null,
  questionIndex: 0,
  answers: [],
  phase: "ask",
  visionReady: false,
  cameraOk: false,
  hintLocked: false,
  hands: [],
  handedness: [],
  face: null,
  lastHandsAt: 0,
  lastFaceAt: 0,
};

const drawState = {
  team: false,
  phase: "countdown",
  startedAt: 0,
  ticking: false,
  strokes: [],
  score: null,
};

const selfie = {
  phase: "seek",
  since: 0,
  alpha: 0,
};

let stream = null;
let running = false;
let raf = 0;
let lastFrame = 0;
let handTs = -1;
let faceTs = -1;
let lastDetect = 0;
let view = { w: 1, h: 1, dpr: 1 };
let modelsPromise = null;
let handLandmarker = null;
let faceLandmarker = null;
let lastVideoTime = -1;
let cameraToken = 0;
let preferHands = true;
let debugOn = false;
let fpsSmooth = 0;
let lastPinch = null;
let lastTilt = null;

const rings = [];

const drawFinish = createDrawFinish();
const palmGate = createEdgeHold(PALM_CLEAR_MS);
let flashTimer = 0;
let drawResultTimer = 0;
const drawScore = document.querySelector("#draw-score");
const drawPercent = document.querySelector("#draw-percent");
const drawStars = document.querySelector("#draw-stars");
const drawBlurb = document.querySelector("#draw-blurb");
const swapTilt = document.querySelector("#swap-tilt");
const heartHold = createEdgeHold(HEART_HOLD_MS);
const photoThumbHold = createEdgeHold(THUMBS_HOLD_MS);
let quizAdvance = createQuizAdvance();
const tilt = createTiltMachine();
const idle = createIdleWatch(IDLE_MS);
const trackers = new Map();
const particles = [];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

meter.style.setProperty("--mark", `${50 - (TILT_ENTER_RAD / METER_SPAN) * 50}%`);

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => enterMode(button.dataset.mode));
});
backBtn.addEventListener("click", goHome);
fullBtn.addEventListener("click", toggleFullscreen);
retryBtn.addEventListener("click", () => enterMode(state.mode));
gateRetry.addEventListener("click", () => enterMode(state.mode));
mythBtn.addEventListener("click", () => answer("myth"));
factBtn.addEventListener("click", () => answer("fact"));
nextBtn.addEventListener("click", goNext);
recenterBtn.addEventListener("click", recenter);
swapTilt.addEventListener("change", () => {
  tilt.disarm();
  setHold(null);
  document.querySelector(".side-myth .side-kicker").textContent = swapTilt.checked ? "Tilt right" : "Tilt left";
  document.querySelector(".side-fact .side-kicker").textContent = swapTilt.checked ? "Tilt left" : "Tilt right";
});
document.querySelector("#photo-take").addEventListener("click", () => beginPhoto(performance.now()));
drawDone.addEventListener("click", finishDrawing);
drawReset.addEventListener("click", resetInk);
teamToggle.addEventListener("change", () => {
  drawState.team = teamToggle.checked;
  trackers.clear();
  clearDrawing();
  resetDrawBoard();
});
cameraSelect.addEventListener("change", onCameraChange);
document.addEventListener("fullscreenchange", syncFullscreenLabel);
document.addEventListener("keydown", onKey);
document.addEventListener("pointerdown", () => idle.mark(performance.now()));
document.addEventListener("visibilitychange", onVisibility);
window.addEventListener("pagehide", stopCamera);
window.addEventListener("resize", () => fitCanvases());
navigator.mediaDevices?.addEventListener?.("devicechange", () => {
  listCameras().catch((error) => console.error(error));
});

const counters = setupStats(() => { nextVisitor(); boothExtras.reset(); });
const boothExtras = setupBoothExtras(counters, state);
const resultScreen = createResultScreen({ onPhoto: () => enterMode("heart"), onHome: nextVisitor,
  onExport: () => counters.record("exports") });
document.getElementById("next-visitor").onclick = nextVisitor;

function nextVisitor() {
  goHome();
  counters.nextVisitor();
}

let currentResult = null;
let factStorage;
try { factStorage = window.localStorage; } catch { /* In-memory fact bag. */ }
const factBag = createFactBag(factStorage);

function showResult(result, photo = false) {
  result = photo ? { ...currentResult, ...result } : {
    ...result, fact: factBag.next(),
    heart: state.mode === "draw" ? normalizeHeart(drawState.strokes) : [],
  };
  currentResult = result;
  if (state.mode === "quiz" && !photo) celebrateFinish();
  if (!photo) counters.record(state.mode);
  boothExtras.refresh();
  boothExtras.leave();
  state.entry += 1;
  cameraToken += 1;
  state.mode = "result";
  state.phase = "done";
  state.visionReady = false;
  stopLoop();
  stopCamera();
  stage.hidden = true;
  resultScreen.show(result, photo);
}

boot();

async function boot() {
  state.questions = pickQuestions(PINK_QUIZ_QUESTIONS, 3);
  quizCount.textContent = "3 questions";
  listCameras().catch((error) => console.error(error));
  loadModels().catch((error) => console.error(error));
}

function loadModels() {
  if (!modelsPromise) {
    modelsPromise = createModels().catch((error) => {
      modelsPromise = null;
      throw error;
    });
  }
  return modelsPromise;
}

async function createModels() {
  const vision = await import(VISION_CDN);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${VISION_CDN}/wasm`);
  const make = async (Task, model, extra) => {
    try {
      return await Task.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model, delegate: "GPU" },
        runningMode: "VIDEO",
        ...extra,
      });
    } catch (gpuError) {
      console.warn("GPU delegate failed, using CPU", gpuError);
      return Task.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: model, delegate: "CPU" },
        runningMode: "VIDEO",
        ...extra,
      });
    }
  };
  const [hands, face] = await Promise.all([
    make(vision.HandLandmarker, HAND_MODEL, {
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
    make(vision.FaceLandmarker, FACE_MODEL, {
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
  ]);
  handLandmarker = hands;
  faceLandmarker = face;
}

async function enterMode(mode) {
  boothExtras.leave();
  if (mode === "quiz" && !state.questions) return;
  if (mode !== "heart") resultScreen.clear();
  counters.start();
  const token = ++state.entry;
  state.mode = mode;
  state.visionReady = false;
  state.cameraOk = false;
  state.hands = [];
  state.face = null;
  lastPinch = null;
  lastTilt = null;
  home.hidden = true;
  stage.hidden = false;
  backBtn.hidden = false;
  quiz.hidden = mode !== "quiz";
  hintBar.hidden = mode === "quiz";
  document.querySelector("#photo-controls").hidden = mode !== "heart";
  document.querySelector("#team-controls").hidden = mode !== "draw";
  drawHud.hidden = mode !== "draw";
  debugEl.hidden = !debugOn;
  hideGate();
  resetMode(mode);
  idle.mark(performance.now());
  startLoop();
  if (mode === "quiz") setQuizNote("Starting the camera…");
  else showGate("Starting the camera…");

  try {
    const opened = await ensureCamera();
    if (!opened || token !== state.entry) return;
  } catch (error) {
    if (token !== state.entry) return;
    console.error(error);
    state.cameraOk = false;
    const message = cameraMessage(error);
    if (mode === "quiz") {
      setQuizNote(`${message} Tap either answer to play.`);
      return;
    }
    showGate(message, { retry: true });
    return;
  }
  if (token !== state.entry) {
    stopCamera();
    return;
  }
  state.cameraOk = true;
  if (mode === "quiz") setQuizNote("Loading face tracking…");
  else showGate(mode === "heart" ? "Loading the camera effects…" : "Loading hand tracking…");

  try {
    await loadModels();
  } catch (error) {
    if (token !== state.entry) return;
    console.error(error);
    const message = "Could not load MediaPipe from the CDN. Check the network and try again.";
    if (mode === "quiz") {
      setQuizNote(`${message} Tap either answer to play.`);
      return;
    }
    showGate(message, { retry: true });
    return;
  }
  if (token !== state.entry) return;
  state.visionReady = true;
  hideGate();
  if (mode === "quiz") setQuizNote("Look straight to set center");
  else setHint(mode === "draw" ? "Get ready to trace the heart" : HINTS.heart, { locked: false });
}

function resetMode(mode) {
  particles.length = 0;
  trackers.clear();
  heartHold.update(false, performance.now());
  clearDrawing();
  resetDrawBoard();
  resetSelfie();
  if (mode === "quiz") {
    state.questions = pickQuestions(PINK_QUIZ_QUESTIONS, 3);
    state.answers = [];
    state.questionIndex = 0;
    quizAdvance = createQuizAdvance();
    state.phase = "ask";
    tilt.recalibrate();
    showAsk();
  }
  document.querySelector("#team-controls").hidden = mode !== "draw";
  drawHud.hidden = mode !== "draw";
}

function resetDrawBoard() {
  clearTimeout(drawResultTimer);
  drawScore.hidden = true;
  teamToggle.disabled = false;
  teamCoverage.textContent = "";
  palmGate.update(false, performance.now());
  drawState.phase = "countdown";
  drawState.startedAt = 0;
  drawState.ticking = false;
  drawState.strokes = [];
  drawFinish.reset(performance.now());
  drawState.score = null;
  drawCount.hidden = true;
  drawActions.hidden = true;
}

function resetSelfie() {
  selfie.phase = "seek";
  photoThumbHold.update(false, 0);
  selfie.since = 0;
  selfie.alpha = 0;
  cornerBadge.hidden = true;
  photoCount.hidden = true;
}

function goHome() {
  boothExtras.leave();
  currentResult = null;
  resultScreen.clear();
  state.entry += 1;
  cameraToken += 1;
  state.mode = "home";
  state.visionReady = false;
  stopLoop();
  stopCamera();
  particles.length = 0;
  clearDrawing();
  resetDrawBoard();
  resetSelfie();
  stage.classList.remove("flash");
  stage.hidden = true;
  home.hidden = false;
  backBtn.hidden = true;
  quiz.hidden = true;
  hintBar.hidden = true;
  drawHud.hidden = true;
  hideGate();
  idle.reset();
}

function startLoop() {
  if (running) return;
  running = true;
  lastFrame = 0;
  raf = requestAnimationFrame(frame);
}

function stopLoop() {
  running = false;
  cancelAnimationFrame(raf);
}

function onVisibility() {
  if (!running) return;
  if (document.hidden) cancelAnimationFrame(raf);
  else raf = requestAnimationFrame(frame);
}

function frame(now) {
  if (!running || document.hidden) return;
  raf = requestAnimationFrame(frame);
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  fitCanvases();
  detect(now);
  if (now - state.lastFaceAt > 400) state.face = null;
  if (now - state.lastHandsAt > 400) state.hands = [];
  if (state.mode === "draw") renderDraw(now);
  else if (state.mode === "heart") renderHeart(now);
  else if (state.mode === "quiz") renderQuiz(now);
  stepParticles(dt);
  paintParticles();
  flushRings();
  paintOverlay(now);
  updateDebug(dt);
  if (state.hands.length || state.face) idle.mark(now);
  if (state.mode !== "home" && idle.expired(now)) nextVisitor();
}

function detect(now) {
  if (!state.visionReady || !state.cameraOk || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  if (now - lastDetect < DETECT_GAP_MS) return;
  lastVideoTime = video.currentTime;
  lastDetect = now;
  try {
    if (state.mode === "quiz") {
      detectFace(now);
      detectHands(now);
    }
    else if (state.mode === "heart") {
      if (preferHands) detectHands(now);
      else detectFace(now);
      preferHands = !preferHands;
    } else detectHands(now);
  } catch (error) {
    state.face = null;
    state.hands = [];
    console.error(error);
  }
}

function detectHands(now) {
  if (!handLandmarker || now <= handTs) return;
  handTs = now;
  const result = handLandmarker.detectForVideo(video, now);
  state.hands = result.landmarks || [];
  state.handedness = result.handednesses || [];
  if (state.hands.length) state.lastHandsAt = now;
}

function detectFace(now) {
  if (!faceLandmarker || now <= faceTs) return;
  faceTs = now;
  const result = faceLandmarker.detectForVideo(video, now);
  state.face = result.faceLandmarks?.[0] || null;
  if (state.face) state.lastFaceAt = now;
}

function renderDraw(now) {
  lastPinch = null;
  if (drawState.phase === "countdown" && state.visionReady && state.cameraOk && gate.hidden) {
    if (!drawState.ticking) {
      drawState.ticking = true;
      drawState.startedAt = now;
    }
    const left = 3 - Math.floor((now - drawState.startedAt) / DRAW_BEAT_MS);
    if (left <= 0) {
      drawState.phase = "draw";
      drawState.drawStartedAt = now;
      thumbsSince = null;
      drawCount.hidden = true;
      drawActions.hidden = false;
      setHint(drawState.team ? "Two hands: each pinch on your half, then trace together" : HINTS.draw, { locked: false });
    } else {
      drawCount.hidden = false;
      drawCount.textContent = String(left);
      setHint("Get ready to trace the heart", { locked: false });
    }
  }

  const recording = drawState.phase === "draw";
  const seen = new Set();
  let anyPinch = false;
  let anyPalm = false;
  let anyThumbs = false;
  const tips = [];

  state.hands.forEach((landmarks, index) => {
    const label = handLabel(state.handedness, index, seen);
    seen.add(label);
    if (!trackers.has(label)) {
      trackers.set(label, {
        filter: createPointFilter({ minCutoff: 1.15, beta: 0.06, dCutoff: 1 }),
        pinch: createPinchLatch(),
        last: null,
        drawing: false,
      });
    }
    const tracker = trackers.get(label);
    const ratio = pinchRatio(landmarks);
    if (ratio != null && (lastPinch == null || ratio < lastPinch)) lastPinch = ratio;
    const closed = tracker.pinch.update(ratio);
    const palm = isOpenPalm(landmarks);
    if (isThumbsUp(landmarks)) anyThumbs = true;
    if (closed) anyPinch = true;
    if (palm) anyPalm = true;
    const raw = toView(landmarks[HAND.INDEX_TIP]);
    const point = raw ? tracker.filter.filter(raw, now) : null;
    if (drawState.team && recording && point && closed && !tracker.side) {
      const side = point.x <= view.w / 2 ? 'left' : 'right';
      if (![...trackers.values()].some(other => other !== tracker && other.side === side)) tracker.side = side;
    }
    const allowed = !drawState.team || (point && tracker.side && acceptsHalf(point, tracker.side, view.w / 2));
    if (recording && point && closed && allowed) {
      const current = drawState.team ? tracker.stroke : drawState.strokes[drawState.strokes.length - 1];
      const jumping = tracker.last && shouldBreakStroke(tracker.last, point, strokeGap());
      if (!tracker.drawing || !current || jumping) {
        const stroke = [point];
        drawState.strokes.push(stroke);
        if (drawState.team) tracker.stroke = stroke;
        paintDot(point);
      } else if (Math.hypot(point.x - tracker.last.x, point.y - tracker.last.y) >= 2) {
        paintSegment(tracker.last, point);
        current.push(point);
      }
      tracker.last = point;
      tracker.drawing = true;
    } else if (!closed || (drawState.team && !allowed)) {
      tracker.drawing = false;
      tracker.last = null;
    }
    if (point) {
      tips.push(point);
      if (closed) queueRing(point, "#ffe4ef", 16);
    }
  });

  for (const [label, tracker] of trackers) {
    if (!seen.has(label)) {
      tracker.filter.reset();
      tracker.pinch.reset();
      tracker.drawing = false;
      tracker.last = null;
    }
  }

  if (recording && shouldClearCanvas(anyPalm, anyPinch) && palmGate.update(true, now)) {
    resetInk();
    flashClear();
  } else if (!shouldClearCanvas(anyPalm, anyPinch)) {
    palmGate.update(false, now);
  }

  if (recording) {
    const result = drawFinish.update({ now, strokes: drawState.strokes,
      target: placeOutline(OUTLINE, view.w / 2, view.h * 0.5, heartGuideSize()),
      pinching: anyPinch });
    thumbsSince = anyThumbs && !anyPinch ? (thumbsSince ?? now) : null;
    const left = Math.max(0, DRAW_LIMIT_MS - (now - drawState.drawStartedAt));
    drawTimer.hidden = false;
    drawTimer.textContent = `${Math.ceil(left / 1000)}s`;
    if (result.reason || left <= 0 || (thumbsSince != null && now - thumbsSince >= THUMBS_HOLD_MS)) {
      thumbsSince = null;
      drawTimer.hidden = true;
      finishDrawing();
    }
  } else {
    drawTimer.hidden = true;
  }

  if (!state.hintLocked && drawState.phase !== "countdown") {
    if (!state.hands.length && now - state.lastHandsAt > 800) {
      setHint("Hold a hand up where the camera can see it", { locked: false });
    } else if (state.hands.length && drawState.phase === "draw") {
      setHint(drawState.team ? "Two hands: each pinch on your half, then trace together" : HINTS.draw, { locked: false });
    }
  }

}

function finishDrawing() {
  if (state.mode !== "draw" || drawState.phase !== "draw") return;
  const result = scoreHeartDrawing(drawState.strokes);
  boothExtras.add(drawState.strokes);
  drawState.score = result;
  drawState.phase = "scored";
  teamToggle.disabled = true;
  celebrateFinish();
  if (drawState.team) {
    const coverage = halfCoverage(drawState.strokes,
      placeOutline(OUTLINE, view.w / 2, view.h * .5, heartGuideSize()), view.w / 2, heartGuideSize() * .06);
    teamCoverage.textContent = `Guide coverage · Left ${coverage.right}% · Right ${coverage.left}%`;
  }
  drawActions.hidden = true;
  drawCount.hidden = true;
  drawScore.hidden = false;
  drawPercent.textContent = `${result.percent}%`;
  drawStars.textContent = `${"★".repeat(result.stars)}${"☆".repeat(5 - result.stars)}`;
  drawBlurb.textContent = heartBlurb(result.stars);
  setHint("That’s your heart", { locked: true });
  if (!reduceMotion) spawnConfetti();
  live.textContent = `Heart score ${result.percent} percent, ${result.stars} of 5 stars.`;
  const artwork = document.createElement("canvas");
  artwork.width = drawLayer.width;
  artwork.height = drawLayer.height;
  const ctx = artwork.getContext("2d");
  ctx.translate(artwork.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(drawLayer, 0, 0);
  const entry = state.entry;
  drawResultTimer = setTimeout(() => {
    if (state.entry === entry && state.mode === "draw" && drawState.phase === "scored") {
      showResult({ artwork, percent: result.percent, stars: result.stars, label: `Draw Hope · Heart tracing ${result.percent}% · ${result.stars}/5 stars` });
    }
  }, 3000);
}

function heartBlurb(stars) {
  if (stars >= 5) return "That’s a heart.";
  if (stars >= 4) return "Very close.";
  if (stars >= 3) return "You can see the heart.";
  if (stars >= 1) return "Keep tracing the outline.";
  return "Trace the pink outline and close the shape.";
}

function flashClear() {
  stage.classList.remove("flash");
  void stage.offsetWidth;
  stage.classList.add("flash");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => stage.classList.remove("flash"), 450);
}

function resetInk() {
  if (drawState.phase === "scored") return;
  drawState.strokes = [];
  drawFinish.reset(performance.now());
  clearDrawing();
  for (const tracker of trackers.values()) {
    tracker.last = null;
    tracker.drawing = false;
    tracker.stroke = null;
    tracker.side = null;
  }
}

function strokeGap() {
  return Math.max(48, Math.min(view.w, view.h) * 0.09);
}

function renderHeart(now) {
  selfie.alpha = 1;
  if (selfie.phase === "seek") {
    const heart = state.hands.length >= 2 && isHeartGesture(state.hands);
    const thumbs = photoThumbHold.update(state.hands.some(isThumbsUp), now);
    if (heartHold.update(heart, now) || thumbs) beginPhoto(now);
    else setHint(HINTS.heart, { locked: false });
  } else if (selfie.phase === "countdown") {
    const left = 3 - Math.floor((now - selfie.since) / PHOTO_BEAT_MS);
    if (left <= 0) {
      photoCount.hidden = true;
      capturePhoto();
      selfie.phase = "preview";
      document.querySelector("#photo-controls").hidden = true;
    } else {
      photoCount.hidden = false;
      photoCount.textContent = String(left);
      setHint("Hold still for the photo", { locked: false });
    }
  }
}

function beginPhoto(now) {
  if (state.mode !== "heart" || selfie.phase !== "seek" || !state.cameraOk || video.readyState < 2) return;
  selfie.phase = "countdown";
  selfie.since = now;
  selfie.alpha = 1;
  live.textContent = "Photo in three seconds";
}

function capturePhoto() {
  const w = 1080;
  const h = 1920;
  const crop = portraitCrop(video.videoWidth, video.videoHeight, faceCentre(state.face));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14060d";
  ctx.fillRect(0, 0, w, h);
  if (video.videoWidth > 0) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
    if (state.face) {
      drawPlayerHeart(
        ctx,
        state.face,
        (point) => ({ x: (point.x * video.videoWidth - crop.x) * w / crop.width,
          y: (point.y * video.videoHeight - crop.y) * h / crop.height }),
        w, h,
      );
    }
    ctx.restore();
  }
  const mappedFace = (state.face ?? []).map(point => ({
    x: (point.x * video.videoWidth - crop.x) * w / crop.width,
    y: (point.y * video.videoHeight - crop.y) * h / crop.height,
  }));
  const mirror = point => ({ x: w - point.x, y: point.y });
  const faceBox = boundsOf(mappedFace.map(mirror), .15);
  const heartBounds = boundsOf(placeHeart(currentResult?.heart, mappedFace, w, h).flat().map(mirror));
  const heartBox = heartBounds && { x: heartBounds.x - w * .009, y: heartBounds.y - w * .009,
    width: heartBounds.width + w * .018, height: heartBounds.height + w * .018 };
  const portrait = composePortrait(document.createElement("canvas"), canvas, faceBox, [], heartBox);
  showResult({ artwork: portrait, label: "My Pink October photo" }, true);
}

function renderQuiz(now) {
  const thumbsUp = state.hands.some(isThumbsUp);
  if (state.phase !== "ask") {
    if (quizAdvance.update({ thumbsUp, now }).advance) goNext();
    movePuck(null);
    setHold(null);
    return;
  }
  const raw =
    state.face && video.videoWidth > 0
      ? eyeLineFromLandmarks(state.face, video.videoWidth, video.videoHeight)
      : null;
  const sample = tilt.update(raw, now, swapTilt.checked);
  lastTilt = typeof sample.angle === "number" ? sample.angle : null;
  if (!state.cameraOk || !state.visionReady) {
    movePuck(0);
    setHold(null);
    return;
  }
  movePuck(sample.angle);
  setHold(sample);
  const input = quizAdvance.update({ thumbsUp, now, angle: sample.angle,
    calibrating: sample.calibrating, tiltChoice: sample.confirmed });
  if (thumbsUp || !input.armed) {
    tilt.disarm();
    setHold(null);
    setQuizNote("Center your head, then tilt again");
    return;
  }
  if (input.tiltChoice) {
    answer(input.tiltChoice);
    return;
  }
  if (!state.face) setQuizNote("No face yet — tap either answer, or use arrow keys");
  else if (sample.calibrating) setQuizNote("Look straight to set center");
  else if (sample.phase === "recenter") setQuizNote("Center your head, then tilt again");
  else if (sample.pending) setQuizNote("Hold the tilt…");
  else setQuizNote("Tilt your head and hold · or tap a side");
}

function recenter() {
  if (state.mode !== "quiz" || state.phase !== "ask") return;
  tilt.recalibrate();
  setHold(null);
  setQuizNote("Look straight to set center");
}

function answer(choice) {
  if (state.mode !== "quiz" || state.phase !== "ask" || !state.questions) return;
  const question = state.questions[state.questionIndex];
  const correct = isCorrectChoice(question, choice);
  state.answers.push({ correct });
  state.phase = "reveal";
  quizAdvance.reveal();
  tilt.disarm();
  verdict.textContent = correct ? "Correct" : "Not quite";
  verdict.className = correct ? "verdict-right" : "verdict-wrong";
  truthLine.textContent = question.correct;
  explanation.textContent = "General awareness · Learn more from the sources below.";
  nextBtn.textContent = state.questionIndex + 1 >= state.questions.length ? "See score" : "Next";
  quizAsk.hidden = true;
  quizReveal.hidden = false;
  mythBtn.disabled = true;
  factBtn.disabled = true;
  setHold(null);
  live.textContent = `${verdict.textContent} ${truthLine.textContent} ${question.correct}`;
  if (correct && !reduceMotion) spawnBurst({ x: view.w / 2, y: view.h * 0.55 }, 28);
  nextBtn.focus();
}

function goNext() {
  if (state.mode !== "quiz" || state.phase !== "reveal" || !quizAdvance.next()) return;
  tilt.disarm();
  state.questionIndex += 1;
  if (state.questionIndex >= state.questions.length) showDone();
  else showAsk();
}

function showAsk() {
  state.phase = "ask";
  const question = state.questions[state.questionIndex];
  const score = state.answers.filter((item) => item.correct).length;
  quizPrompt.textContent = question.prompt;
  mythBtn.querySelector("strong").textContent = question.left;
  factBtn.querySelector("strong").textContent = question.right;
  quizProgress.textContent = `Question ${state.questionIndex + 1} of ${state.questions.length} · Score ${score}`;
  quizAsk.hidden = false;
  quizReveal.hidden = true;
  mythBtn.disabled = false;
  factBtn.disabled = false;
  setHold(null);
}

function showDone() {
  const score = scoreQuiz(state.answers);
  showResult({ ...score, label: `Myth or Fact · ${score.correct} of ${score.total} correct` });
}

function setQuizNote(text) {
  if (quizNote.textContent !== text) quizNote.textContent = text;
}

function movePuck(roll) {
  const t = typeof roll === "number" ? Math.max(-1, Math.min(1, roll / METER_SPAN)) : 0;
  meterPuck.style.left = `${50 - t * 50}%`;
}

function setHold(sample) {
  const pending = sample?.pending;
  const progress = sample ? Math.round(sample.progress * 100) : 0;
  mythBtn.classList.toggle("charging", pending === "myth");
  factBtn.classList.toggle("charging", pending === "fact");
  mythHold.style.width = pending === "myth" ? `${progress}%` : "0%";
  factHold.style.width = pending === "fact" ? `${progress}%` : "0%";
  mythFill.style.height = pending === "myth" ? `${progress}%` : "0%";
  factFill.style.height = pending === "fact" ? `${progress}%` : "0%";
}

function showGate(body, { retry = false } = {}) {
  gateTitle.textContent = MODE_TITLE[state.mode] || "";
  gateText.textContent = body;
  gateRetry.hidden = !retry;
  gate.hidden = false;
  hintBar.hidden = true;
  state.hintLocked = true;
}

function hideGate() {
  gate.hidden = true;
}

function setHint(text, { locked = false, retry = false } = {}) {
  state.hintLocked = locked;
  if (text && hintText.textContent !== text) hintText.textContent = text;
  const hideBar = !text || state.mode === "quiz" || state.mode === "home" || !gate.hidden;
  if (hintBar.hidden !== hideBar) hintBar.hidden = hideBar;
  retryBtn.hidden = !retry;
}

function readCameraId() {
  try {
    return localStorage.getItem(CAMERA_KEY) || "";
  } catch {
    return "";
  }
}

function writeCameraId(id) {
  try {
    if (id) localStorage.setItem(CAMERA_KEY, id);
    else localStorage.removeItem(CAMERA_KEY);
  } catch {
    /* private mode or blocked storage */
  }
}

async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
  const saved = readCameraId();
  cameraSelect.replaceChildren();
  const fallback = document.createElement("option");
  fallback.value = "";
  fallback.textContent = "Default camera";
  cameraSelect.append(fallback);
  devices.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Camera ${index + 1}`;
    cameraSelect.append(option);
  });
  if ([...cameraSelect.options].some((option) => option.value === saved)) cameraSelect.value = saved;
}

async function onCameraChange() {
  writeCameraId(cameraSelect.value);
  idle.mark(performance.now());
  if (state.mode === "home" || state.mode === "result") return;
  // Restart setup too: a previous permission/model failure may still need recovery.
  stopCamera();
  await enterMode(state.mode);
}

async function ensureCamera() {
  const token = ++cameraToken;
  const wanted = readCameraId();
  if (stream && stream.getVideoTracks().some((track) => track.readyState === "live")) {
    const current = stream.getVideoTracks()[0].getSettings().deviceId || "";
    if (!wanted || current === wanted) {
      if (video.paused) await video.play();
      await listCameras().catch((error) => console.warn("Camera list unavailable", error));
      return token === cameraToken;
    }
    stopCamera();
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("Camera API missing");
    error.name = "SecurityError";
    throw error;
  }
  let next;
  try {
    next = await openCamera(wanted);
  } catch (error) {
    if (token !== cameraToken) return false;
    if (!wanted) throw error;
    writeCameraId("");
    cameraSelect.value = "";
    next = await openCamera("");
  }
  if (token !== cameraToken) {
    next.getTracks().forEach((track) => track.stop());
    return false;
  }
  stopCamera();
  stream = next;
  video.srcObject = stream;
  try {
    await video.play();
  } catch (error) {
    if (stream === next) stopCamera();
    else next.getTracks().forEach((track) => track.stop());
    if (token !== cameraToken) return false;
    throw error;
  }
  if (token !== cameraToken) {
    // A newer request may already own the video; never stop its stream.
    if (stream === next) stopCamera();
    else next.getTracks().forEach((track) => track.stop());
    return false;
  }
  await listCameras().catch((error) => console.warn("Camera list unavailable", error));
  return token === cameraToken;
}

function openCamera(deviceId) {
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };
  if (deviceId) videoConstraints.deviceId = { exact: deviceId };
  else videoConstraints.facingMode = "user";
  return navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
}

function stopCamera() {
  state.cameraOk = false;
  state.face = null;
  state.hands = [];
  state.handedness = [];
  lastVideoTime = -1;
  tilt.recalibrate();
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
  video.srcObject = null;
}

function cameraMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia || error?.name === "SecurityError") {
    return "Open this page from a local server (http://localhost) so Chrome can use the camera.";
  }
  if (error?.name === "NotAllowedError") {
    return "Camera blocked. Allow the camera for this page in Chrome, then try again.";
  }
  return "No camera found. Check the webcam and Chrome’s site settings, then try again.";
}

function handLabel(handedness, index, seen) {
  const name = handedness?.[index]?.[0]?.categoryName || "Hand";
  return seen.has(name) ? `${name}-${index}` : name;
}

function toView(point) {
  if (!point || !(video.videoWidth > 0)) return null;
  return mapCoverPoint(point.x, point.y, video.videoWidth, video.videoHeight, view.w, view.h);
}

function fitCanvases() {
  const rect = stage.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  view = { w, h, dpr };
  resizeCanvas(drawLayer, drawCtx, w, h, dpr, true);
  resizeCanvas(fxLayer, fxCtx, w, h, dpr, false);
}

function resizeCanvas(canvas, ctx, w, h, dpr, persist) {
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width === bw && canvas.height === bh) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return;
  }
  let copy = null;
  if (persist && canvas.width && canvas.height) {
    copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d").drawImage(canvas, 0, 0);
  }
  canvas.width = bw;
  canvas.height = bh;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (copy) ctx.drawImage(copy, 0, 0, copy.width, copy.height, 0, 0, w, h);
}

function clearDrawing() {
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].kind === "trail") particles.splice(i, 1);
  }
  drawCtx.setTransform(1, 0, 0, 1, 0, 0);
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  drawCtx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
}

function paintDot(point) {
  trailHeart(point);
  drawCtx.fillStyle = "#ff3d78";
  drawCtx.beginPath();
  drawCtx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  drawCtx.fill();
}

function paintSegment(from, to) {
  trailHeart(to);
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.strokeStyle = "#ff3d78";
  drawCtx.lineWidth = 8;
  drawCtx.shadowBlur = 0;
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();
  drawCtx.shadowBlur = 0;
  drawCtx.strokeStyle = "rgba(255, 236, 244, 0.9)";
  drawCtx.lineWidth = 2;
  drawCtx.stroke();
}

function paintOverlay(now) {
  if (state.mode === "draw" && gate.hidden && state.cameraOk) {
    const ghost = placeOutline(OUTLINE, view.w / 2, view.h * 0.5, heartGuideSize());
    fxCtx.save();
    fxCtx.strokeStyle = "rgba(255, 236, 244, 0.9)";
    fxCtx.lineWidth = 3;
    fxCtx.setLineDash([10, 12]);
    fxCtx.lineJoin = "round";
    fxCtx.lineCap = "round";
    fxCtx.beginPath();
    ghost.forEach((point, index) => {
      if (index === 0) fxCtx.moveTo(point.x, point.y);
      else fxCtx.lineTo(point.x, point.y);
    });
    fxCtx.closePath();
    fxCtx.stroke();
    fxCtx.restore();
  }

  if (state.mode === "heart" && state.face && selfie.alpha > 0) {
    drawPlayerHeart(fxCtx, state.face, (point) => toView(point), view.w, view.h);
  }
}

function drawPlayerHeart(ctx, landmarks, mapPoint, width, height) {
  const mapped = [];
  for (const i of [234, 454, 10]) mapped[i] = landmarks[i] ? mapPoint(landmarks[i]) : null;
  const strokes = placeHeart(currentResult?.heart, mapped, width, height);
  ctx.save();
  ctx.strokeStyle = "#C51D61";
  ctx.lineWidth = Math.max(3, Math.min(width, height) * 0.009);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    ctx.beginPath();
    stroke.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  }
  ctx.restore();
}

function queueRing(point, color, radius) {
  rings.push({ point, color, radius });
}

function flushRings() {
  for (const ring of rings) {
    fxCtx.beginPath();
    fxCtx.lineWidth = 3;
    fxCtx.strokeStyle = ring.color;
    fxCtx.arc(ring.point.x, ring.point.y, ring.radius, 0, Math.PI * 2);
    fxCtx.stroke();
  }
  rings.length = 0;
}

function spawnBurst(point, count = 36) {
  for (let i = 0; i < count; i += 1) {
    if (particles.length > 240) particles.shift();
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;
    particles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 1.1 + Math.random() * 0.5,
      max: 1.6,
      size: 10 + Math.random() * 14,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 3,
      color: ["#ff3d78", "#ff7aa2", "#ffd0e1", "#fff0f5"][i % 4],
      kind: "burst",
    });
  }
}

function spawnConfetti() {
  const origin = { x: view.w / 2, y: view.h * 0.38 };
  spawnBurst(origin, 40);
  for (let i = 0; i < 80; i += 1) {
    if (particles.length > 240) particles.shift();
    const speed = 160 + Math.random() * 380;
    particles.push({
      kind: "confetti",
      x: origin.x + (Math.random() - 0.5) * view.w * 0.5,
      y: origin.y + Math.random() * 20,
      vx: (Math.random() - 0.5) * speed,
      vy: -Math.random() * speed,
      life: 1.5 + Math.random() * 0.8,
      max: 2.3,
      w: 7 + Math.random() * 7,
      h: 12 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 8,
      color: ["#ff3d78", "#ffd0e1", "#fff7f4", "#ff7aa2", "#ffb3cc"][i % 5],
    });
  }
}

function stepParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    if (particle.kind === "burst") particle.vy += 40 * dt;
    if (particle.kind === "confetti") particle.vy += 260 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.rot += particle.vr * dt;
  }
}

const trailMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastTrailAt = -Infinity;
function trailHeart(point) {
  const now = performance.now();
  if (now - lastTrailAt < 65 || trailMotion.matches) return;
  lastTrailAt = now;
  particles.push({ kind: 'trail', x: point.x, y: point.y, size: 9, rot: 0,
    color: '#C51D61', life: 0.65, max: 0.65, vx: 0, vy: 0, vr: 0 });
}

function paintParticles() {
  fxCtx.setTransform(1, 0, 0, 1, 0, 0);
  fxCtx.clearRect(0, 0, fxLayer.width, fxLayer.height);
  fxCtx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  for (const particle of particles) {
    if (particle.kind === "confetti") {
      fxCtx.save();
      fxCtx.translate(particle.x, particle.y);
      fxCtx.rotate(particle.rot);
      fxCtx.globalAlpha = Math.max(0, particle.life / particle.max);
      fxCtx.fillStyle = particle.color;
      fxCtx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
      fxCtx.restore();
    } else {
      drawHeartShape(fxCtx, particle.x, particle.y, particle.size, particle.rot, particle.color, particle.life / particle.max);
    }
  }
}

function drawHeartShape(ctx, x, y, size, rot, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(0, size * 0.05, -size * 0.55, size * 0.05, -size * 0.55, -size * 0.25);
  ctx.bezierCurveTo(-size * 0.55, -size * 0.6, -size * 0.15, -size * 0.7, 0, -size * 0.4);
  ctx.bezierCurveTo(size * 0.15, -size * 0.7, size * 0.55, -size * 0.6, size * 0.55, -size * 0.25);
  ctx.bezierCurveTo(size * 0.55, size * 0.05, 0, size * 0.05, 0, size * 0.3);
  ctx.fill();
  ctx.restore();
}

function drawCover(ctx, image, srcW, srcH, dstW, dstH) {
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;
  if (srcAspect > dstAspect) {
    sw = srcH * dstAspect;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / dstAspect;
    sy = (srcH - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dstW, dstH);
}

function updateDebug(dt) {
  if (dt > 0) {
    const instant = 1 / dt;
    fpsSmooth = fpsSmooth ? fpsSmooth * 0.9 + instant * 0.1 : instant;
  }
  if (!debugOn) return;
  const pinch = lastPinch == null ? "—" : lastPinch.toFixed(2);
  const tiltText = lastTilt == null ? "—" : `${((lastTilt * 180) / Math.PI).toFixed(1)}°`;
  debugEl.textContent = `FPS ${Math.round(fpsSmooth)}\nPinch ${pinch}\nTilt ${tiltText}`;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  } catch { /* Fullscreen is optional, including on iPhone. */ }
}

function syncFullscreenLabel() {
  fullBtn.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
}

function typingTarget(event) {
  const tag = event.target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function onKey(event) {
  if (document.getElementById("stats").open) return;
  if (event.repeat) return;
  idle.mark(performance.now());
  if (typingTarget(event)) return;
  if ((event.key === "d" || event.key === "D") && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    debugOn = !debugOn;
    debugEl.hidden = !debugOn;
    return;
  }
  if (state.mode !== "quiz") return;
  if (state.phase === "ask") {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      answer("myth");
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      answer("fact");
    }
  } else if (state.phase === "reveal" && (event.key === "Enter" || event.key === " ")) {
    if (event.target === nextBtn) return;
    event.preventDefault();
    goNext();
  }
}

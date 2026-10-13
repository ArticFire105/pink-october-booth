import { createEdgeHold } from "../js/gestures.js";
import { portraitCrop, faceCentre } from "../js/portrait-crop.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
// Run the actual app functions with device/DOM doubles, without loading MediaPipe.
function appFunctions(names, context) {
  const code = names.map(name => {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    const end = source.indexOf("\n}", start) + 2;
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
  }).join("\n");
  runInNewContext(code, context);
  return context;
}
function camera() {
  let stopped = 0;
  const track = { readyState: "live", stop() { stopped++; }, getSettings: () => ({ deviceId: "test" }) };
  return { getTracks: () => [track], getVideoTracks: () => [track], get stopped() { return stopped; } };
}
function setup(extra = {}) {
  return appFunctions(["ensureCamera", "stopCamera"], {
    cameraToken: 0, stream: null, state: { cameraOk: true, face: {}, hands: [{}] },
    lastVideoTime: 10, tilt: { recalibrate() {} },
    readCameraId: () => "", navigator: { mediaDevices: { getUserMedia() {} } },
    video: { play: async () => {} }, listCameras: async () => {}, console: { warn() {} }, ...extra,
  });
}

test("camera playback failure stops tracks and clears tracking", async () => {
  const stream = camera();
  const app = setup({ openCamera: async () => stream, video: { play: async () => { throw Error("Playback failed"); } } });
  await assert.rejects(app.ensureCamera(), /Playback failed/);
  assert.equal(stream.stopped, 1);
  assert.equal(app.stream, null);
  assert.equal(app.video.srcObject, null);
  assert.equal(app.state.face, null);
  assert.equal(app.state.hands.length, 0);
  assert.equal(app.state.cameraOk, false);
  assert.equal(app.lastVideoTime, -1);
});

test("stale playback completion cannot stop a newer camera stream", async () => {
  let finish, playing;
  const ready = new Promise(resolve => { playing = resolve; });
  const old = camera(), current = camera();
  const app = setup({ openCamera: async () => old, video: { play: () => new Promise(resolve => { finish = resolve; playing(); }) } });
  const pending = app.ensureCamera();
  await ready;
  app.cameraToken++;
  app.stream = current;
  app.video.srcObject = current;
  finish();
  assert.equal(await pending, false);
  assert.equal(old.stopped, 1);
  assert.equal(current.stopped, 0);
  assert.equal(app.video.srcObject, current);
});

test("device enumeration failure does not reject a working camera", async () => {
  const stream = camera();
  const app = setup({ openCamera: async () => stream, listCameras: async () => { throw Error("Unavailable"); } });
  assert.equal(await app.ensureCamera(), true);
  assert.equal(stream.stopped, 0);
});

test("camera selection restarts mode setup after a failure", async () => {
  const calls = [];
  const app = appFunctions(["onCameraChange"], {
    state: { mode: "quiz" }, cameraSelect: { value: "phone" },
    writeCameraId: id => calls.push(id), idle: { mark() {} }, performance: { now: () => 0 },
    stopCamera: () => calls.push("stop"), enterMode: async mode => calls.push(mode),
  });
  await app.onCameraChange();
  assert.deepEqual(calls, ["phone", "stop", "quiz"]);
});

test("fullscreen absence and rejection are harmless", async () => {
  for (const document of [{ documentElement: {} }, {
    documentElement: { requestFullscreen() { throw Error("Unsupported"); } },
  }, { fullscreenElement: {}, exitFullscreen: async () => { throw Error("Denied"); } }]) {
    await appFunctions(["toggleFullscreen"], { document }).toggleFullscreen();
  }
});

test("drawing export mirrors the ink just like the displayed canvas", () => {
  const calls = [];
  const ink = { width: 800, height: 600 };
  const ctx = { translate: (...args) => calls.push(["translate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]), drawImage: (...args) => calls.push(["draw", ...args]) };
  const app = appFunctions(["finishDrawing"], {
    teamToggle: {}, celebrateFinish() {},
    boothExtras: { add() {} },
    state: { mode: "draw" }, drawState: { phase: "draw", strokes: [] },
    scoreHeartDrawing: () => ({ percent: 0, stars: 0 }), placeOutline() {}, OUTLINE: [],
    view: { w: 800, h: 600 }, drawActions: {}, drawCount: {}, drawLayer: ink,
    drawScore: {}, drawPercent: {}, drawStars: {}, drawBlurb: {},
    heartBlurb: () => "", setHint() {}, reduceMotion: false,
    spawnConfetti: () => calls.push(["confetti"]), live: {}, drawResultTimer: 0,
    setTimeout: callback => { calls.push(["scheduled"]); app.complete = callback; },
    document: { createElement: () => ({ getContext: () => ctx }) },
    showResult: () => calls.push(["result"]),
  });
  app.finishDrawing();
  assert.deepEqual(calls, [["confetti"], ["translate", 800, 0], ["scale", -1, 1], ["draw", ink, 0, 0], ["scheduled"]]);
  assert.equal(app.drawStars.textContent, "☆☆☆☆☆");
  app.complete();
  assert.deepEqual(calls.at(-1), ["result"]);
});

test("completed result keeps one fact and the actual heart across photo retakes", () => {
  let draws = 0;
  const shown = [];
  const heart = [[{ x: 0, y: 0 }, { x: 1, y: 1 }]];
  const app = appFunctions(["showResult"], {
    state: { mode: "draw", entry: 0 }, cameraToken: 0, currentResult: null,
    drawState: { strokes: heart }, normalizeHeart: strokes => structuredClone(strokes),
    factBag: { next: () => { draws++; return "Selected fact"; } },
    counters: { record() {} }, boothExtras: { refresh() {}, leave() {} },
    celebrateFinish() {}, stopLoop() {}, stopCamera() {}, stage: {},
    resultScreen: { show: result => shown.push(result) },
  });
  app.showResult({ percent: 82, stars: 4, artwork: "drawing" });
  app.drawState.strokes = [];
  app.showResult({ artwork: "photo" }, true);
  app.showResult({ artwork: "retake" }, true);
  assert.equal(draws, 1);
  assert.equal(shown[2].fact, "Selected fact");
  assert.deepEqual(shown[2].heart, heart);
  assert.equal(shown[2].percent, 82);
  assert.equal(shown[2].artwork, "retake");
  app.state.mode = "quiz";
  app.showResult({ correct: 3, total: 4 });
  assert.equal(shown[3].heart.length, 0);
});

test("photo captures a mirrored 9:16 portrait crop and drawn overlay together", () => {
  const calls = [];
  const ctx = Object.fromEntries(["fillRect", "save", "restore", "strokeRect", "fillText"].map(k => [k, () => {}]));
  ctx.translate = (...args) => calls.push(["translate", ...args]);
  ctx.scale = (...args) => calls.push(["scale", ...args]);
  ctx.drawImage = (...args) => calls.push(["video", ...args.slice(1)]);
  const canvas = { getContext: () => ctx };
  const app = appFunctions(["capturePhoto"], {
    portraitCrop, faceCentre, boundsOf: () => null, placeHeart: () => [], currentResult: null,
    composePortrait: (target, source) => { assert.equal(source, canvas); return target; },
    view: { w: 800, h: 600 }, state: { face: [] },
    video: { videoWidth: 1920, videoHeight: 1080 },
    document: { createElement: () => canvas }, mapCoverPoint() {},
    drawCover: (...args) => calls.push(["video", ...args.slice(-2)]),
    drawPlayerHeart: (...args) => calls.push(["heart", ...args.slice(-2)]),
    showResult: (result, photo) => { assert.equal(result.artwork, canvas); assert.equal(photo, true); },
  });
  app.capturePhoto();
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1920);
  assert.deepEqual(calls, [["translate", 1080, 0], ["scale", -1, 1], ["video", 656.25, 0, 607.5, 1080, 0, 0, 1080, 1920], ["heart", 1080, 1920]]);
});

test("photo thumbs-up starts countdown after 500 ms; button works without a face", () => {
  const counts = { hidden: true };
  let captures = 0;
  const app = appFunctions(["renderHeart", "beginPhoto"], {
    selfie: { phase: "seek", since: 0 },
    state: { mode: "heart", cameraOk: true, hands: ["thumb"], face: null },
    video: { readyState: 2 }, live: {}, HINTS: { heart: "Thumbs up to take photo" },
    isThumbsUp: hand => hand === "thumb", isHeartGesture: () => false,
    photoThumbHold: createEdgeHold(500), heartHold: createEdgeHold(500),
    PHOTO_BEAT_MS: 1000, photoCount: counts, setHint() {},
    capturePhoto: () => captures++, document: { querySelector: () => ({}) },
  });
  app.renderHeart(0);
  app.renderHeart(499);
  assert.equal(app.selfie.phase, "seek");
  app.renderHeart(500);
  assert.equal(app.selfie.phase, "countdown");
  for (const [now, expected] of [[501, "3"], [1500, "2"], [2500, "1"]]) {
    app.renderHeart(now);
    assert.equal(counts.textContent, expected);
  }
  app.renderHeart(3500);
  assert.equal(captures, 1);
  app.selfie.phase = "seek";
  app.state.hands = [];
  app.beginPhoto(4000);
  assert.equal(app.selfie.phase, "countdown");
});

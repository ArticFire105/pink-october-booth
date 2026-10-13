/** Eye-line input in camera pixels. Positive slope becomes a left lean in
 * the mirrored view (MYTH); negative becomes right (FACT). */
export const EYE_LEFT = 33;
export const EYE_RIGHT = 263;

export const TILT_ENTER_RAD = (12 * Math.PI) / 180;
export const TILT_EXIT_RAD = (6 * Math.PI) / 180;
export const TILT_HOLD_MS = 700;
export const TILT_CALIBRATE_MS = 800;

// An eye line has no direction: angles differing by 180° are equivalent.
export function normalizeEyeAngle(angle) {
  return ((angle + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
}

export function eyeLineRadians(left, right, frameWidth, frameHeight) {
  if (!left || !right) return null;
  if (![left.x, left.y, right.x, right.y, frameWidth, frameHeight].every(Number.isFinite)) return null;
  if (!(frameWidth > 0) || !(frameHeight > 0)) return null;
  const dx = (left.x - right.x) * frameWidth;
  const dy = (left.y - right.y) * frameHeight;
  if (dx === 0 && dy === 0) return null;
  return normalizeEyeAngle(Math.atan2(dy, dx));
}

export function eyeLineFromLandmarks(landmarks, frameWidth, frameHeight) {
  if (!landmarks || landmarks.length <= EYE_RIGHT) return null;
  return eyeLineRadians(landmarks[EYE_LEFT], landmarks[EYE_RIGHT], frameWidth, frameHeight);
}

export function createEma(alpha = 0.35) {
  let value = null;
  return {
    push(sample) {
      if (typeof sample !== "number" || !Number.isFinite(sample)) return value;
      const t = Math.max(0, Math.min(1, alpha));
      value = value == null ? sample : value + t * (sample - value);
      return value;
    },
    reset() {
      value = null;
    },
    get() {
      return value;
    },
  };
}

/**
 * Stay on a side until the angle falls back inside the exit band,
 * so a noisy reading on the threshold does not flicker.
 */
export function createHysteresis({ enter = TILT_ENTER_RAD, exit = TILT_EXIT_RAD } = {}) {
  let side = null;
  return {
    update(angle) {
      if (typeof angle !== "number" || !Number.isFinite(angle)) return side;
      if (side === "myth") {
        if (angle < exit) side = angle <= -enter ? "fact" : null;
      } else if (side === "fact") {
        if (angle > -exit) side = angle >= enter ? "myth" : null;
      } else if (angle >= enter) side = "myth";
      else if (angle <= -enter) side = "fact";
      return side;
    },
    reset() {
      side = null;
    },
    get() {
      return side;
    },
  };
}

function snapshot(extra) {
  return {
    phase: "idle",
    angle: null,
    side: null,
    pending: null,
    progress: 0,
    confirmed: null,
    calibrating: false,
    calibrationProgress: 0,
    ...extra,
  };
}

/**
 * Timestamp state machine:
 * calibrating → idle → holding → locked → recenter → idle.
 * `now` is a millisecond timestamp. Missing landmarks cancel a pending hold.
 */
export function createTiltMachine({
  holdMs = TILT_HOLD_MS,
  enter = TILT_ENTER_RAD,
  exit = TILT_EXIT_RAD,
  calibrateMs = TILT_CALIBRATE_MS,
  emaAlpha = 0.4,
  stableRad = 0.09,
} = {}) {
  const ema = createEma(emaAlpha);
  const hyst = createHysteresis({ enter, exit });
  let phase = "calibrating";
  let samples = [];
  let calStart = null;
  let neutral = 0;
  let since = 0;
  let side = null;
  let locked = null;
  let missingSince = null;

  function beginCalibration() {
    phase = "calibrating";
    samples = [];
    calStart = null;
    neutral = 0;
    since = 0;
    side = null;
    locked = null;
    missingSince = null;
    ema.reset();
    hyst.reset();
  }

  return {
    update(rawAngle, now, swapped = false) {
      const angle = Number.isFinite(rawAngle) ? normalizeEyeAngle(rawAngle) : null;

      if (phase === "calibrating") {
        if (angle == null) {
          calStart = null;
          samples = [];
          return snapshot({
            phase,
            calibrating: true,
            calibrationProgress: calStart == null ? 0 : Math.max(0, Math.min(1, (now - calStart) / calibrateMs)),
          });
        }
        if (calStart == null || (samples.length && Math.abs(normalizeEyeAngle(angle - samples[samples.length - 1])) > stableRad)) {
          calStart = now;
          samples = [angle];
        } else {
          samples.push(angle);
        }
        const progress = Math.max(0, Math.min(1, (now - calStart) / calibrateMs));
        if (now - calStart >= calibrateMs && samples.length >= 3) {
          neutral = Math.atan2(samples.reduce((sum, v) => sum + Math.sin(2 * v), 0),
            samples.reduce((sum, v) => sum + Math.cos(2 * v), 0)) / 2;
          phase = "idle";
          ema.reset();
          hyst.reset();
          missingSince = null;
        }
        return snapshot({
          phase: phase === "idle" ? "idle" : "calibrating",
          calibrating: phase === "calibrating",
          calibrationProgress: phase === "calibrating" ? progress : 1,
          angle: 0,
        });
      }

      if (angle == null) {
        missingSince ??= now;
        if (now - missingSince >= 900) {
          beginCalibration();
          return snapshot({ phase, calibrating: true });
        }
        if (phase === "holding") phase = "idle";
        side = null;
        ema.reset();
        hyst.reset();
        return snapshot({ phase });
      }

      missingSince = null;
      const corrected = normalizeEyeAngle(angle - neutral) * (swapped ? -1 : 1);
      const smooth = ema.push(corrected);
      const nextSide = hyst.update(smooth);

      if (phase === "recenter") {
        if (nextSide == null) {
          phase = "idle";
          side = null;
          since = now;
        }
        return snapshot({ phase, angle: smooth, side: null, pending: null, progress: 0 });
      }

      if (phase === "locked") {
        return snapshot({ phase, angle: smooth, side: locked, pending: null, progress: 1, confirmed: locked });
      }

      if (nextSide == null) {
        phase = "idle";
        side = null;
        since = now;
        return snapshot({ phase, angle: smooth, progress: 0 });
      }

      if (nextSide !== side || phase !== "holding") {
        side = nextSide;
        since = now;
        phase = "holding";
      }

      const elapsed = now - since;
      const progress = Math.max(0, Math.min(1, holdMs <= 0 ? 1 : elapsed / holdMs));
      if (holdMs <= 0 || elapsed >= holdMs) {
        phase = "locked";
        locked = nextSide;
        return snapshot({ phase, angle: smooth, side: nextSide, pending: null, progress: 1, confirmed: locked });
      }
      return snapshot({ phase, angle: smooth, side: nextSide, pending: nextSide, progress });
    },
    disarm() {
      if (phase !== "calibrating") phase = "recenter";
      locked = null;
      side = null;
      since = 0;
      hyst.reset();
      ema.reset();
    },
    recalibrate() {
      beginCalibration();
    },
    neutral() {
      return neutral;
    },
  };
}

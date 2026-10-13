import { createEdgeHold } from "./gestures.js";
import { TILT_EXIT_RAD } from "./tilt.js";

// Gesture timing and phase transitions only; tilt calibration stays in tilt.js.
export function createQuizAdvance({ count = 3, holdMs = 500 } = {}) {
  const hold = createEdgeHold(holdMs);
  let phase = "ask", index = 0, armed = true;
  return {
    reveal() {
      if (phase !== "ask") return;
      phase = "reveal";
      hold.update(false, 0);
    },
    next() {
      if (phase !== "reveal") return false;
      index += 1;
      phase = index >= count ? "done" : "ask";
      armed = false;
      hold.update(false, 0);
      return true;
    },
    update({ thumbsUp = false, angle = null, calibrating = false, tiltChoice = null, now }) {
      if (phase === "ask" && !calibrating && Number.isFinite(angle) &&
          Math.abs(angle) < TILT_EXIT_RAD) armed = true;
      const advance = hold.update(phase === "reveal" && thumbsUp, now);
      return { advance, tiltChoice: phase === "ask" && armed && !thumbsUp ? tiltChoice : null,
        armed, phase, index };
    },
  };
}

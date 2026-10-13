import { bboxDiagonal } from "./heart-score.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const strokeLength = (stroke) => stroke.slice(1).reduce((sum, p, i) => sum + distance(p, stroke[i]), 0);

// Only gate automatic completion; capture and scoring retain v2 behavior.
// Most of a heart means roughly 70% of its perimeter, spanning the guide.
export function drawingProgress(strokes, target) {
  const size = bboxDiagonal(target);
  if (!size) return { enough: false, closed: false };
  const points = strokes.flat();
  const length = strokes.reduce((sum, stroke) => sum + strokeLength(stroke), 0);
  const enough = points.length >= 8 && length >= strokeLength(target) * 0.7 &&
    bboxDiagonal(points) >= size * 0.6;
  const closed = enough && distance(points[0], points.at(-1)) <= size * 0.09;
  return { enough, closed };
}

export function createDrawFinish({ releaseMs = 1500 } = {}) {
  let releasedAt = null;
  return {
    reset() { releasedAt = null; },
    update({ now, strokes, target, pinching }) {
      const progress = drawingProgress(strokes, target);
      if (progress.enough && !pinching) releasedAt ??= now;
      else releasedAt = null;
      const reason = progress.closed ? "closed" :
        releasedAt != null && now - releasedAt >= releaseMs ? "released" : null;
      return { ...progress, reason };
    },
  };
}

/**
 * Pure gesture math for the Pink October booth.
 * No camera, DOM, or MediaPipe runtime — unit tests drive these directly.
 *
 * Hand topology is the 21-point MediaPipe hand.
 */

export const HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

/** Pinch if thumb and index tips are closer than this fraction of hand size. */
export const PINCH_RATIO = 0.45;
/** Air Draw latches on below this ratio and stays on until the fingers open past the off ratio. */
export const PINCH_ON_RATIO = 0.38;
export const PINCH_OFF_RATIO = 0.55;
/** A wider pinch still counts as "not an open palm", so releasing a pinch does not clear. */
export const PALM_PINCH_BLOCK_RATIO = 0.58;
/** Index tips (and thumb tips) count as touching within this fraction of hand size. */
export const HEART_CLOSENESS = 0.65;
/** Index pair must sit above the thumb pair by this fraction of hand size. */
export const HEART_MIN_GAP_RATIO = 0.25;
/** Each hand's own index tip must sit above its thumb tip. */
export const HEART_HAND_GAP_RATIO = 0.18;
/** Wrists stay apart so a prayer pose is not a heart. */
export const HEART_MIN_WRIST_RATIO = 0.95;
/** Middle fingertips must be farther apart than the index tips by this fraction of hand size. */
export const HEART_MIDDLE_EXTRA = 0.4;
/** How long an open palm must be held before the canvas clears. */
export const PALM_CLEAR_MS = 280;

export function dist(a, b) {
  const ax = a?.x;
  const ay = a?.y;
  const bx = b?.x;
  const by = b?.y;
  if (![ax, ay, bx, by].every(Number.isFinite)) return Infinity;
  return Math.hypot(ax - bx, ay - by);
}

export function handScale(landmarks) {
  if (!validHand(landmarks)) return 0;
  return dist(landmarks[HAND.WRIST], landmarks[HAND.MIDDLE_MCP]);
}

export function validHand(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const needed = [HAND.WRIST, HAND.THUMB_TIP, HAND.INDEX_TIP, HAND.MIDDLE_MCP, HAND.MIDDLE_TIP];
  return needed.every((index) => {
    const point = landmarks[index];
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  });
}

export function pinchRatio(landmarks) {
  if (!validHand(landmarks)) return null;
  const scale = handScale(landmarks);
  if (!(scale > 1e-4)) return null;
  return dist(landmarks[HAND.THUMB_TIP], landmarks[HAND.INDEX_TIP]) / scale;
}

export function isPinching(landmarks, ratio = PINCH_RATIO) {
  const gap = pinchRatio(landmarks);
  if (gap == null) return false;
  return gap < ratio;
}

/**
 * Pinch latch. Closes when the gap is under `onRatio` of the hand size,
 * and stays closed until the fingers open past `offRatio`.
 */
export function createPinchLatch({ onRatio = PINCH_ON_RATIO, offRatio = PINCH_OFF_RATIO } = {}) {
  let closed = false;
  return {
    update(ratio) {
      if (typeof ratio !== "number" || !Number.isFinite(ratio)) {
        closed = false;
        return false;
      }
      closed = closed ? ratio < offRatio : ratio < onRatio;
      return closed;
    },
    reset() {
      closed = false;
    },
    get() {
      return closed;
    },
  };
}

function fingerExtended(landmarks, tipIndex, pipIndex) {
  const wrist = landmarks[HAND.WRIST];
  const tip = landmarks[tipIndex];
  const pip = landmarks[pipIndex];
  if (!tip || !pip) return false;
  return dist(tip, wrist) > dist(pip, wrist) * 1.05;
}

export function isOpenPalm(landmarks) {
  if (!validHand(landmarks)) return false;
  if (isPinching(landmarks, PALM_PINCH_BLOCK_RATIO)) return false;
  const fingers = [
    [HAND.INDEX_TIP, HAND.INDEX_PIP],
    [HAND.MIDDLE_TIP, HAND.MIDDLE_PIP],
    [HAND.RING_TIP, HAND.RING_PIP],
    [HAND.PINKY_TIP, HAND.PINKY_PIP],
  ];
  if (!fingers.every(([tip, pip]) => fingerExtended(landmarks, tip, pip))) return false;
  const tipToIndex = dist(landmarks[HAND.THUMB_TIP], landmarks[HAND.INDEX_MCP]);
  const ipToIndex = dist(landmarks[HAND.THUMB_IP], landmarks[HAND.INDEX_MCP]);
  return tipToIndex > ipToIndex * 1.08;
}

/**
 * Two-hand heart: index tips meet at the top, thumb tips meet at the bottom,
 * wrists and middle fingers stay apart (so prayer hands do not count).
 */
export function isHeartGesture(hands, options = {}) {
  if (!hands || hands.length < 2) return false;
  const a = hands[0];
  const b = hands[1];
  if (!validHand(a) || !validHand(b)) return false;
  const scale = (handScale(a) + handScale(b)) / 2;
  if (!(scale > 1e-4)) return false;

  const closeness = options.closeness ?? HEART_CLOSENESS;
  const minGapRatio = options.minGapRatio ?? HEART_MIN_GAP_RATIO;
  const handGapRatio = options.handGapRatio ?? HEART_HAND_GAP_RATIO;
  const minWristRatio = options.minWristRatio ?? HEART_MIN_WRIST_RATIO;
  const middleExtra = options.middleExtra ?? HEART_MIDDLE_EXTRA;

  const indexDist = dist(a[HAND.INDEX_TIP], b[HAND.INDEX_TIP]);
  const thumbDist = dist(a[HAND.THUMB_TIP], b[HAND.THUMB_TIP]);
  const middleDist = dist(a[HAND.MIDDLE_TIP], b[HAND.MIDDLE_TIP]);
  const wristDist = dist(a[HAND.WRIST], b[HAND.WRIST]);
  const indexY = (a[HAND.INDEX_TIP].y + b[HAND.INDEX_TIP].y) / 2;
  const thumbY = (a[HAND.THUMB_TIP].y + b[HAND.THUMB_TIP].y) / 2;

  const oriented = (landmarks) =>
    landmarks[HAND.THUMB_TIP].y - landmarks[HAND.INDEX_TIP].y > scale * handGapRatio;

  return (
    indexDist < scale * closeness &&
    thumbDist < scale * closeness &&
    thumbY - indexY > scale * minGapRatio &&
    oriented(a) &&
    oriented(b) &&
    middleDist > indexDist + scale * middleExtra &&
    wristDist > scale * minWristRatio
  );
}

export function heartCenter(hands) {
  if (!hands || hands.length < 2 || !validHand(hands[0]) || !validHand(hands[1])) return null;
  const points = [
    hands[0][HAND.THUMB_TIP],
    hands[0][HAND.INDEX_TIP],
    hands[1][HAND.THUMB_TIP],
    hands[1][HAND.INDEX_TIP],
  ];
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

/** Fires once after `active` stays true for holdMs, then waits for a release. */
export function createEdgeHold(holdMs) {
  let since = null;
  let latched = false;
  return {
    update(active, now) {
      if (!active) {
        since = null;
        latched = false;
        return false;
      }
      if (latched) return false;
      if (since == null) since = now;
      if (holdMs <= 0 || now - since >= holdMs) {
        latched = true;
        return true;
      }
      return false;
    },
  };
}

export function shouldClearCanvas(anyOpenPalm, anyPinch) {
  return Boolean(anyOpenPalm) && !anyPinch;
}

export function createStrokeState() {
  let active = false;
  return {
    update(pinching) {
      if (pinching && active) return "continue";
      if (pinching && !active) {
        active = true;
        return "start";
      }
      if (!pinching && active) {
        active = false;
        return "end";
      }
      return "idle";
    },
  };
}

export function smoothPoint(previous, next, alpha = 0.65) {
  if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) return previous;
  if (!previous) return { x: next.x, y: next.y };
  const t = Math.max(0, Math.min(1, alpha));
  return {
    x: previous.x + (next.x - previous.x) * t,
    y: previous.y + (next.y - previous.y) * t,
  };
}

/**
 * Map a normalized landmark into a CSS box that shows the video with object-fit: cover.
 */
export function mapCoverPoint(nx, ny, srcW, srcH, dstW, dstH) {
  if (!(srcW > 0) || !(srcH > 0) || !(dstW > 0) || !(dstH > 0)) return null;
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let renderW;
  let renderH;
  let offsetX;
  let offsetY;
  if (srcAspect > dstAspect) {
    renderH = dstH;
    renderW = dstH * srcAspect;
    offsetX = (dstW - renderW) / 2;
    offsetY = 0;
  } else {
    renderW = dstW;
    renderH = dstW / srcAspect;
    offsetX = 0;
    offsetY = (dstH - renderH) / 2;
  }
  return {
    x: offsetX + nx * renderW,
    y: offsetY + ny * renderH,
  };
}

/**
 * Rising-edge latch. `displayMs` is how long the event stays "showing".
 * `cooldownMs` is extra quiet time after it hides before it can fire again.
 */
export function createTriggerLatch(cooldownMs) {
  let readyAt = 0;
  let activeUntil = 0;
  return {
    fire(condition, now, displayMs) {
      if (now < activeUntil) return false;
      if (condition && now >= readyAt) {
        activeUntil = now + displayMs;
        readyAt = activeUntil + cooldownMs;
        return true;
      }
      return false;
    },
    showing(now) {
      return now < activeUntil;
    },
    reset() {
      readyAt = 0;
      activeUntil = 0;
    },
  };
}

/** Thumbs-up: thumb tip clearly above IP and MCP (smaller y), other four fingers curled. */
export function isThumbsUp(landmarks) {
  if (!validHand(landmarks)) return false;
  const s = handScale(landmarks);
  if (!s) return false;
  const [w, mcp, ip, tip] = [landmarks[0], landmarks[2], landmarks[3], landmarks[4]];
  const up = tip.y < ip.y - 0.15 * s && ip.y < mcp.y && tip.y < mcp.y - 0.3 * s;
  const curled = [[8, 6], [12, 10], [16, 14], [20, 18]].every(([t, pip]) => dist(landmarks[t], w) < dist(landmarks[pip], w));
  return up && curled;
}

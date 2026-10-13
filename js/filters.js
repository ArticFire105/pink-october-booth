/**
 * One Euro filter (Casiez, Roussel, Vogel 2012) for a single channel.
 * Timestamps are milliseconds.
 */
export function createOneEuroFilter({ minCutoff = 1.2, beta = 0.04, dCutoff = 1 } = {}) {
  let xPrev = null;
  let dxPrev = 0;
  let tPrev = null;

  function alpha(dt, cutoff) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  return {
    filter(x, tMs) {
      if (!Number.isFinite(x) || !Number.isFinite(tMs)) return xPrev;
      if (tPrev == null || xPrev == null) {
        tPrev = tMs;
        xPrev = x;
        dxPrev = 0;
        return x;
      }
      const dt = Math.max(1e-3, (tMs - tPrev) / 1000);
      const dx = (x - xPrev) / dt;
      const aD = alpha(dt, dCutoff);
      const dxHat = dxPrev + aD * (dx - dxPrev);
      const cutoff = minCutoff + beta * Math.abs(dxHat);
      const xHat = xPrev + alpha(dt, cutoff) * (x - xPrev);
      xPrev = xHat;
      dxPrev = dxHat;
      tPrev = tMs;
      return xHat;
    },
    reset() {
      xPrev = null;
      dxPrev = 0;
      tPrev = null;
    },
  };
}

export function createPointFilter(options) {
  const xFilter = createOneEuroFilter(options);
  const yFilter = createOneEuroFilter(options);
  return {
    filter(point, tMs) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      return { x: xFilter.filter(point.x, tMs), y: yFilter.filter(point.y, tMs) };
    },
    reset() {
      xFilter.reset();
      yFilter.reset();
    },
  };
}

/** Start a new stroke segment when the fingertip jumps. */
export function shouldBreakStroke(previous, next, maxGap) {
  if (!previous || !next) return false;
  if (![previous.x, previous.y, next.x, next.y, maxGap].every(Number.isFinite)) return false;
  return Math.hypot(next.x - previous.x, next.y - previous.y) > maxGap;
}

export function createIdleWatch(timeoutMs) {
  let last = 0;
  let started = false;
  return {
    mark(now) {
      last = now;
      started = true;
    },
    expired(now) {
      return started && now - last >= timeoutMs;
    },
    reset() {
      started = false;
      last = 0;
    },
  };
}

// Post-drawing video interlude: pure timing state machine (no DOM).
// Phases: hold (player's heart shown) -> video -> reveal (heart fades into centre) -> end (hold) -> done.
export const INTERLUDE = { holdMs: 1000, revealAt: 6.0, revealMs: 700, endHoldMs: 1000, thumbsMs: 500 };

export function shouldPlayInterlude({ reduceMotion = false, videoOk = true } = {}) {
  return !reduceMotion && videoOk;
}

export function createInterlude(start, opts = {}) {
  const o = { ...INTERLUDE, ...opts };
  let phase = 'hold', videoStart = null, revealStart = null, endStart = null;
  let seenOpen = false, thumbSince = null, failed = false;
  const toReveal = now => { phase = 'reveal'; revealStart = now; };
  const api = {
    get phase() { return phase; },
    // videoTime: seconds into the clip (null if not yet playing)
    update(now, { videoTime = null, thumbsUp = false, handOpen = false } = {}) {
      if (phase === 'done') return api.state(now);
      if (!thumbsUp && handOpen) seenOpen = true;
      if (seenOpen && thumbsUp && phase !== 'end') {
        thumbSince ??= now;
        if (now - thumbSince >= o.thumbsMs) api.skip(now);
      } else if (!thumbsUp) thumbSince = null;
      if (phase === 'hold' && now - start >= o.holdMs) { phase = 'video'; videoStart = now; }
      if (phase === 'video' && videoTime != null && videoTime >= o.revealAt) toReveal(now);
      if (phase === 'reveal' && now - revealStart >= o.revealMs) { phase = 'end'; endStart = now; }
      if (phase === 'end' && now - endStart >= o.endHoldMs) phase = 'done';
      return api.state(now);
    },
    skip(now) {
      if (phase === 'done' || phase === 'end') return;
      phase = 'end'; revealStart = now - o.revealMs; endStart = now;
    },
    fail() { failed = true; phase = 'done'; },
    get failed() { return failed; },
    state(now) {
      const reveal = phase === 'reveal' ? Math.min(1, (now - revealStart) / o.revealMs)
        : phase === 'end' || (phase === 'done' && !failed) ? 1 : 0;
      return { phase, reveal, videoStarted: videoStart != null, done: phase === 'done' };
    },
  };
  return api;
}

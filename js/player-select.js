// Pick and keep the main player (closest to the frame centre) when several people are visible.
// Coordinates are MediaPipe-normalised (0–1); centre is (0.5, 0.5).

export function landmarkBox(points, step = 1) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (let i = 0; i < (points?.length ?? 0); i += step) {
    const p = points[i]; if (!p) continue;
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, size: Math.max(0, x1 - x0, y1 - y0), top: y0, bottom: y1 };
}

const centreDist = c => Math.hypot(c.x - 0.5, c.y - 0.5);
// Lower is better: distance to centre, with a small bonus for larger (nearer) candidates.
export function centreScore(c) { return centreDist(c) - 0.15 * (c.size ?? 0); }

export function mostCentral(cands) {
  let best = -1, score = Infinity;
  cands.forEach((c, i) => { const s = centreScore(c); if (s < score - 1e-9) { score = s; best = i; } });
  return best;
}

// Hysteresis: stay on the locked person unless they vanish for lostMs, or someone else is
// clearly (margin) more central for switchMs.
export function createPlayerLock({ lostMs = 500, switchMs = 1000, margin = 0.12, matchDist = 0.18 } = {}) {
  let locked = null, lastSeen = -Infinity, challengerSince = null;
  return {
    get locked() { return locked; },
    reset() { locked = null; lastSeen = -Infinity; challengerSince = null; },
    update(cands, now) {
      if (!cands.length) {
        if (locked && now - lastSeen > lostMs) locked = null;
        challengerSince = null;
        return -1;
      }
      let match = -1;
      if (locked) {
        let d = Infinity;
        cands.forEach((c, i) => { const di = Math.hypot(c.x - locked.x, c.y - locked.y); if (di < d) { d = di; match = i; } });
        if (d > matchDist) match = -1;
      }
      if (match < 0) {
        if (locked && now - lastSeen <= lostMs) return -1; // briefly lost: don't jump to someone else
        match = mostCentral(cands);
        challengerSince = null;
      } else {
        const best = mostCentral(cands);
        if (best !== match && centreScore(cands[best]) < centreScore(cands[match]) - margin) {
          challengerSince ??= now;
          if (now - challengerSince >= switchMs) { match = best; challengerSince = null; }
        } else challengerSince = null;
      }
      locked = { x: cands[match].x, y: cands[match].y };
      lastSeen = now;
      return match;
    },
  };
}

// Keep at most `max` hands belonging to the player: near the chosen face if known, else
// around the most central (locked) hand.
export function selectPlayerHands(hands, { face = null, primary = -1, max = 2, reach = 0.32, pair = 0.28 } = {}) {
  const wrists = hands.map(h => h?.[0] ?? { x: 0.5, y: 0.5 });
  let idx = hands.map((_, i) => i);
  if (face) {
    const r = Math.max(reach, face.size * 2.2);
    idx = idx.filter(i => Math.abs(wrists[i].x - face.x) <= r && wrists[i].y >= face.top - face.size * 0.5);
    idx.sort((a, b) => Math.abs(wrists[a].x - face.x) - Math.abs(wrists[b].x - face.x));
  } else if (primary >= 0 && primary < hands.length) {
    const p = wrists[primary];
    idx = idx.filter(i => i === primary || Math.abs(wrists[i].x - p.x) <= pair);
    idx.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : Math.abs(wrists[a].x - p.x) - Math.abs(wrists[b].x - p.x)));
  } else {
    idx.sort((a, b) => centreDist(wrists[a]) - centreDist(wrists[b]));
  }
  return idx.slice(0, max);
}

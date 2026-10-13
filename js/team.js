// Coordinates are canvas coordinates; the preview mirrors them horizontally.
export function acceptsHalf(point, side, center) {
  return side === 'left' ? point.x <= center : point.x >= center;
}

// Percentage of guide samples reached by actual ink segments, independently per half.
export function halfCoverage(strokes, target, center, tolerance) {
  function near(p, stroke) {
    return stroke.some((b, i) => {
      const a = stroke[Math.max(0, i - 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= tolerance;
    });
  }
  return Object.fromEntries(['left', 'right'].map(side => {
    const samples = target.filter(p => acceptsHalf(p, side, center));
    const covered = samples.filter(p => strokes.some(stroke => near(p, stroke))).length;
    return [side, samples.length ? Math.round(100 * covered / samples.length) : 0];
  }));
}

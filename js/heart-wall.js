export const HEART_WALL_KEY = 'pink-october-heart-wall-v1';
// Only coordinates cross this boundary; samples and artwork count are bounded.
export function normalizeStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  const clean = strokes.slice(0, 32).filter(Array.isArray).map(stroke => {
    const points = stroke.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
    const step = Math.max(1, Math.ceil(points.length / 128));
    return points.filter((_, i) => i % step === 0 || i === points.length - 1);
  }).filter(s => s.length > 1);
  const points = clean.flat();
  if (!points.length) return [];
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top;
  const size = Math.max(width, height);
  if (!size || !Number.isFinite(size)) return [];
  return clean.map(s => s.map(p => ({
    x: Number(((p.x - left + (size - width) / 2) / size).toFixed(4)),
    y: Number(((p.y - top + (size - height) / 2) / size).toFixed(4)),
  })));
}
export function createHeartWall(storage) {
  let hearts = [];
  try {
    const parsed = JSON.parse(storage.getItem(HEART_WALL_KEY));
    if (Array.isArray(parsed)) hearts = parsed.slice(-8).map(normalizeStrokes).filter(s => s.length);
  } catch { /* Storage is optional. */ }
  const save = () => { try { storage.setItem(HEART_WALL_KEY, JSON.stringify(hearts)); } catch { /* Keep in memory. */ } };
  return {
    add(strokes) { const heart = normalizeStrokes(strokes); if (!heart.length) return; hearts = [...hearts, heart].slice(-8); save(); },
    reset() { hearts = []; save(); },
    snapshot() { return hearts.map(h => h.map(s => s.map(p => ({ ...p })))); },
  };
}

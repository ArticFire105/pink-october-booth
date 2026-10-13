// Preserve every captured point and stroke break in a square normalized space.
// Preview and capture both mirror these camera-oriented coordinates.
export function normalizeHeart(strokes) {
  const clean = (strokes ?? []).map(s => s.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)))
    .filter(s => s.length > 1);
  const points = clean.flat();
  if (!points.length) return [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) {
    left = Math.min(left, p.x); right = Math.max(right, p.x);
    top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
  }
  const size = Math.max(right - left, bottom - top);
  if (!size) return [];
  return clean.map(s => s.map(p => ({
    x: (p.x - left + (size - (right - left)) / 2) / size,
    y: (p.y - top + (size - (bottom - top)) / 2) / size,
  })));
}
// Landmarks are already mapped into the same cover-cropped pixel space.
export function placeHeart(strokes, landmarks, width, height) {
  const a = landmarks?.[234], b = landmarks?.[454], brow = landmarks?.[10];
  if (!strokes?.length || ![width, height].every(n => Number.isFinite(n) && n > 0) ||
      ![a, b, brow].every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return [];
  const faceWidth = Math.hypot(b.x - a.x, b.y - a.y);
  if (!faceWidth) return [];
  const margin = Math.min(width, height) * 0.025;
  const size = Math.min(faceWidth * 0.8, width * 0.32, height * 0.42);
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
  const x = width - right >= left ? right + faceWidth * 0.12 : left - faceWidth * 0.12 - size;
  const clampedX = Math.max(margin, Math.min(width - size - margin, x));
  const y = Math.max(margin, Math.min(height - size - margin, brow.y));
  return strokes.map(s => s.map(p => ({ x: clampedX + p.x * size, y: y + p.y * size })));
}

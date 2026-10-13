/**
 * Score a traced heart against a canonical outline.
 * Chamfer distance (both ways) plus symmetry and closure.
 * Points are in the same coordinate space. The score is scale-invariant:
 * both clouds are centered and scaled to a unit diagonal before comparing.
 */

export function heartOutline(samples = 72) {
  const points = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    points.push({ x, y });
  }
  return normalizeCloud(points);
}

export function placeOutline(outline, cx, cy, size) {
  return outline.map((point) => ({
    x: cx + point.x * size,
    y: cy + point.y * size,
  }));
}

export function bboxDiagonal(points) {
  if (!points.length) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

export function resample(points, count) {
  if (points.length === 0) return [];
  if (points.length === 1 || count <= 1) return [{ ...points[0] }];
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return Array.from({ length: count }, () => ({ ...points[0] }));
  const out = [];
  let seg = 1;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / (count - 1);
    while (seg < lengths.length - 1 && lengths[seg] < target) seg += 1;
    const prev = lengths[seg - 1];
    const span = lengths[seg] - prev || 1;
    const t = (target - prev) / span;
    const a = points[seg - 1];
    const b = points[seg];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function normalizeCloud(points) {
  if (!points.length) return [];
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= points.length;
  cy /= points.length;
  const centered = points.map((point) => ({ x: point.x - cx, y: point.y - cy }));
  const diag = bboxDiagonal(centered) || 1;
  return centered.map((point) => ({ x: point.x / diag, y: point.y / diag }));
}

function minDistance(point, cloud) {
  let best = Infinity;
  for (const other of cloud) {
    const d = Math.hypot(point.x - other.x, point.y - other.y);
    if (d < best) best = d;
  }
  return best;
}

export function chamferDistance(a, b) {
  if (!a.length || !b.length) return Infinity;
  let ab = 0;
  let ba = 0;
  for (const point of a) ab += minDistance(point, b);
  for (const point of b) ba += minDistance(point, a);
  return (ab / a.length + ba / b.length) / 2;
}

export function symmetryScore(points) {
  if (points.length < 6) return 0;
  const mid = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const reflected = points.map((point) => ({ x: 2 * mid - point.x, y: point.y }));
  const size = bboxDiagonal(points) || 1;
  const distance = chamferDistance(resample(points, 36), resample(reflected, 36)) / size;
  return clamp01(1 - distance / 0.28);
}

export function closureScore(points) {
  if (points.length < 2) return 0;
  const size = bboxDiagonal(points) || 1;
  const gap = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  return clamp01(1 - gap / size / 0.35);
}

export function starsForPercent(percent) {
  if (percent >= 88) return 5;
  if (percent >= 74) return 4;
  if (percent >= 58) return 3;
  if (percent >= 40) return 2;
  if (percent >= 18) return 1;
  return 0;
}

export function scoreHeartDrawing(stroke, target = heartOutline()) {
  const flat = stroke.flat ? stroke.flat() : stroke;
  if (flat.length < 8) {
    return { percent: 0, stars: 0, chamfer: 1, symmetry: 0, closure: 0 };
  }
  const drawn = normalizeCloud(resample(flat, 56));
  const goal = normalizeCloud(resample(target, 64));
  const chamfer = chamferDistance(drawn, goal);
  const shape = clamp01(1 - chamfer / 0.22);
  const symmetry = symmetryScore(flat);
  const closure = closureScore(flat);
  const percent = Math.round(100 * (0.62 * shape + 0.23 * symmetry + 0.15 * closure));
  return { percent, stars: starsForPercent(percent), chamfer, symmetry, closure };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

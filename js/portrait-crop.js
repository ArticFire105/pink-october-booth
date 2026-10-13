// Centre is in normalized, unmirrored camera coordinates.
export function portraitCrop(width, height, centre) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError("Frame dimensions must be positive");
  }
  const h = Math.min(height, width * 16 / 9);
  const w = h * 9 / 16;
  const valid = Number.isFinite(centre?.x) && Number.isFinite(centre?.y);
  const x = (valid ? centre.x : 0.5) * width;
  const y = (valid ? centre.y : 0.5) * height;
  return { x: Math.max(0, Math.min(width - w, x - w / 2)),
    y: Math.max(0, Math.min(height - h, y - h / 2)), width: w, height: h };
}

export function faceCentre(landmarks) {
  const points = (landmarks ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (!points.length) return null;
  return { x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2 };
}

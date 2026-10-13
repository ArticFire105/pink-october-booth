// Air keyboard for an optional player name. Pure logic: layout, hit-testing, input debounce.
export const NAME_MAX = 12;
export const ROWS = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ"];
// Normalised screen box the keyboard occupies (fractions of the stage).
export const KEYBOARD_BOX = { x: .14, y: .30, w: .72, h: .56 };

export function sanitizeName(value, max = NAME_MAX) {
  return String(value ?? "").replace(/[^A-Za-z ]+/g, "").replace(/\s+/g, " ").replace(/^ /, "").slice(0, max);
}
export function finalName(value) { return sanitizeName(value).trim(); }

// Keys with normalised rects inside the stage. Last row adds Space, Backspace and Skip.
export function keyboardLayout(box = KEYBOARD_BOX) {
  const rows = ROWS.length + 1, gap = .012;
  const rowH = box.h / rows;
  const keys = [];
  ROWS.forEach((row, r) => {
    const cols = 7, keyW = box.w / cols;
    const offset = (cols - row.length) * keyW / 2;
    [...row].forEach((ch, c) => keys.push({ id: ch, label: ch,
      x: box.x + offset + c * keyW + gap / 2, y: box.y + r * rowH + gap / 2, w: keyW - gap, h: rowH - gap }));
  });
  const y = box.y + ROWS.length * rowH + gap / 2, h = rowH - gap;
  const spec = [["SKIP", "Skip", 1.4], ["SPACE", "Space", 3.2], ["BACK", "⌫", 1.4], ["OK", "✓ Done", 1.4]];
  const total = spec.reduce((s, [, , u]) => s + u, 0);
  let x = box.x;
  for (const [id, label, units] of spec) {
    const w = box.w * units / total;
    keys.push({ id, label, x: x + gap / 2, y, w: w - gap, h });
    x += w;
  }
  return keys;
}

export function hitKey(keys, point) {
  if (!point) return null;
  return keys.find(k => point.x >= k.x && point.x <= k.x + k.w && point.y >= k.y && point.y <= k.y + k.h) ?? null;
}

// One pinch (press edge) types one key; a release is required and presses closer than minGapMs are ignored.
export function createNameEntry({ max = NAME_MAX, minGapMs = 280, confirmMs = 500 } = {}) {
  let name = "", wasPinching = true, lastPress = -Infinity, thumbSince = null, result = null;
  function press(id, now = 0) {
    if (result) return result;
    if (id === "SKIP") return (result = { done: true, name: "" });
    if (id === "OK") { if (finalName(name)) result = { done: true, name: finalName(name) }; return result; }
    if (id === "BACK") name = name.slice(0, -1);
    else if (id === "SPACE") { if (name && !name.endsWith(" ")) name = sanitizeName(name + " ", max); }
    else if (/^[A-Z]$/.test(id)) name = sanitizeName(name + (name ? id.toLowerCase() : id), max);
    lastPress = now;
    return null;
  }
  return {
    get name() { return name; },
    get result() { return result; },
    press,
    // key: hovered key id or null; pinching: boolean; thumbsUp: boolean.
    update({ key = null, pinching = false, thumbsUp = false, now = 0 } = {}) {
      if (result) return { name, typed: null, result, confirmProgress: 1 };
      let typed = null;
      if (pinching && !wasPinching && key && now - lastPress >= minGapMs) { typed = key; press(key, now); }
      wasPinching = pinching;
      let confirmProgress = 0;
      if (thumbsUp && !pinching && finalName(name)) {
        thumbSince ??= now;
        confirmProgress = Math.min(1, (now - thumbSince) / confirmMs);
        if (confirmProgress >= 1) result = { done: true, name: finalName(name) };
      } else thumbSince = null;
      return { name, typed, result, confirmProgress };
    },
  };
}

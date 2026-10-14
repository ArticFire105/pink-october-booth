// Automatic exposure compensation for hand/face tracking under harsh ceiling lights.
// Pure math (stats, easing, tone curve) + a small frame processor for an offscreen canvas.

export const NEUTRAL = Object.freeze({ brightness: 1, contrast: 1, glare: 0 });
export const LIMITS = Object.freeze({
  brightness: [0.6, 1.5], contrast: [0.7, 1.6], glare: [0, 1],
});
export const TARGET = Object.freeze({ mean: 0.47, std: 0.2, whiteLimit: 0.02 });
const WHITE = 0.92;

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

// Luma stats of an RGBA buffer: mean (0–1), standard deviation and fraction of near-white pixels.
export function frameStats(data, step = 4) {
  let n = 0, sum = 0, sq = 0, white = 0;
  for (let i = 0; i + 2 < data.length; i += 4 * step) {
    const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    sum += y; sq += y * y; n += 1;
    if (y >= WHITE) white += 1;
  }
  if (!n) return { mean: TARGET.mean, std: TARGET.std, white: 0 };
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), white: white / n };
}

// Where settings should head for a frame with these stats.
export function targetSettings({ mean, std, white }) {
  const glare = clamp((white - TARGET.whiteLimit) * 8, LIMITS.glare);
  // Glare makes the mean look bright even when hands are dark: discount the blown-out share.
  const effective = Math.max(0.02, mean - white * 0.5);
  const brightness = clamp(TARGET.mean / effective, LIMITS.brightness);
  const contrast = clamp(std > 0.01 ? TARGET.std / std : 1, LIMITS.contrast);
  return { brightness, contrast, glare };
}

// Ease current settings toward target; dtMs since last step; small changes ignored (no flicker).
export function stepSettings(current, target, dtMs, { timeMs = 2500, deadband = 0.02 } = {}) {
  const k = Math.min(1, Math.max(0, dtMs) / timeMs);
  const out = {};
  for (const key of Object.keys(NEUTRAL)) {
    const c = current[key] ?? NEUTRAL[key], t = target[key] ?? NEUTRAL[key];
    const next = Math.abs(t - c) < deadband ? c : c + (t - c) * k;
    out[key] = clamp(next, LIMITS[key]);
  }
  return out;
}

export function isNeutral(s, eps = 0.01) {
  return Math.abs(s.brightness - 1) < eps && Math.abs(s.contrast - 1) < eps && s.glare < eps;
}

// Tone curve: contrast around mid-grey, brightness gain, then a soft highlight knee ("glare cut").
export function tone(v, { brightness = 1, contrast = 1, glare = 0 } = {}) {
  let x = ((v - 0.5) * contrast + 0.5) * brightness;
  const knee = 0.75 - 0.25 * glare;
  if (glare > 0 && x > knee) x = knee + (x - knee) / (1 + glare * 3 * (x - knee) / (1 - knee));
  return Math.min(1, Math.max(0, x));
}

export function buildLut(settings) {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = Math.round(tone(i / 255, settings) * 255);
  return lut;
}

// Lighter, display-only CSS approximation (no glare knee) so the mirror looks natural.
export function displayFilter(s, strength = 0.5) {
  if (isNeutral(s)) return "";
  const b = 1 + (s.brightness - 1) * strength, c = 1 + (s.contrast - 1) * strength;
  return `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)})`;
}

const STORE = "pob-light-settings";
export function loadLightPrefs(storage = globalThis.localStorage) {
  const base = { auto: true, manual: { ...NEUTRAL } };
  try {
    const v = JSON.parse(storage?.getItem(STORE) || "null");
    if (!v) return base;
    return { auto: v.auto !== false, manual: stepSettings(NEUTRAL, v.manual ?? {}, 1e9, { deadband: 0 }) };
  } catch { return base; }
}
export function saveLightPrefs(prefs, storage = globalThis.localStorage) {
  try { storage?.setItem(STORE, JSON.stringify({ auto: prefs.auto, manual: prefs.manual })); } catch {}
}

// Offscreen processor. Returns the source to feed to MediaPipe (canvas when correcting, else the video).
export function createLightProcessor({ width = 640, sampleEveryMs = 1500, doc = globalThis.document } = {}) {
  const canvas = doc.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const probe = doc.createElement("canvas"); probe.width = 64; probe.height = 36;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  let prefs = loadLightPrefs(), current = { ...NEUTRAL }, target = { ...NEUTRAL };
  let lastSample = -Infinity, lastStep = 0, lut = null, lutKey = "", stats = null;
  const active = () => (prefs.auto ? current : prefs.manual);
  return {
    get prefs() { return prefs; },
    get settings() { return active(); },
    get stats() { return stats; },
    setPrefs(next) { prefs = { ...prefs, ...next, manual: { ...prefs.manual, ...(next.manual ?? {}) } }; saveLightPrefs(prefs); },
    frame(video, now) {
      if (!(video?.videoWidth > 0)) return video;
      if (prefs.auto && now - lastSample >= sampleEveryMs) {
        lastSample = now;
        pctx.drawImage(video, 0, 0, probe.width, probe.height);
        stats = frameStats(pctx.getImageData(0, 0, probe.width, probe.height).data, 1);
        target = targetSettings(stats);
      }
      if (prefs.auto) { current = stepSettings(current, target, lastStep ? now - lastStep : 0); }
      lastStep = now;
      const s = active();
      if (isNeutral(s)) return video;
      const h = Math.round(width * video.videoHeight / video.videoWidth);
      if (canvas.width !== width || canvas.height !== h) { canvas.width = width; canvas.height = h; }
      ctx.drawImage(video, 0, 0, width, h);
      const key = `${s.brightness.toFixed(2)}|${s.contrast.toFixed(2)}|${s.glare.toFixed(2)}`;
      if (key !== lutKey) { lut = buildLut(s); lutKey = key; }
      const img = ctx.getImageData(0, 0, width, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
      ctx.putImageData(img, 0, 0);
      return canvas;
    },
  };
}

// Ask the camera for continuous auto exposure / white balance when supported. Never throws.
export async function applyCameraLightConstraints(track) {
  try {
    const caps = track?.getCapabilities?.() ?? {};
    const advanced = {};
    if (caps.exposureMode?.includes?.("continuous")) advanced.exposureMode = "continuous";
    if (caps.whiteBalanceMode?.includes?.("continuous")) advanced.whiteBalanceMode = "continuous";
    if (!Object.keys(advanced).length) return false;
    await track.applyConstraints({ advanced: [advanced] });
    return true;
  } catch { return false; }
}

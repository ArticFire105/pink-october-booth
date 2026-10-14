import test from "node:test";
import assert from "node:assert/strict";
import { frameStats, targetSettings, stepSettings, tone, buildLut, isNeutral, displayFilter,
  loadLightPrefs, saveLightPrefs, applyCameraLightConstraints, NEUTRAL, LIMITS } from "../js/light-adjust.js";

const frame = (values) => { const d = new Uint8ClampedArray(values.length * 4); values.forEach((v, i) => { d.set([v, v, v, 255], i * 4); }); return d; };

test("frameStats reports mean luma, spread and near-white share", () => {
  const s = frameStats(frame([0, 255, 0, 255]), 1);
  assert.ok(Math.abs(s.mean - .5) < 1e-9); assert.ok(Math.abs(s.std - .5) < 1e-9); assert.equal(s.white, .5);
  assert.equal(frameStats(new Uint8ClampedArray(0)).white, 0);
});

test("dark scenes brighten, glary scenes get glare cut, normal scenes stay near neutral", () => {
  const dark = targetSettings({ mean: .2, std: .2, white: 0 });
  assert.ok(dark.brightness > 1.4); assert.equal(dark.glare, 0);
  const glary = targetSettings({ mean: .7, std: .3, white: .15 });
  assert.equal(glary.glare, 1); assert.ok(glary.brightness < 1.2);
  const ok = targetSettings({ mean: .47, std: .2, white: .01 });
  assert.ok(isNeutral(ok, .02));
  const flat = targetSettings({ mean: .5, std: .05, white: 0 });
  assert.equal(flat.contrast, LIMITS.contrast[1]);
});

test("stepSettings eases toward the target, clamps, and ignores tiny changes", () => {
  const half = stepSettings(NEUTRAL, { brightness: 1.4, contrast: 1, glare: 1 }, 1250, { timeMs: 2500 });
  assert.ok(Math.abs(half.brightness - 1.2) < 1e-9); assert.ok(Math.abs(half.glare - .5) < 1e-9);
  assert.deepEqual(stepSettings(NEUTRAL, { brightness: 1.01, contrast: .99, glare: .01 }, 1000), NEUTRAL);
  const clamped = stepSettings(NEUTRAL, { brightness: 9, contrast: -3, glare: 4 }, 1e9);
  assert.deepEqual(clamped, { brightness: LIMITS.brightness[1], contrast: LIMITS.contrast[0], glare: 1 });
  assert.deepEqual(stepSettings(NEUTRAL, { brightness: 1.5 }, 0), NEUTRAL, "no time, no change");
});

test("repeated steps converge without overshoot (no flicker)", () => {
  let s = { ...NEUTRAL }; const t = { brightness: 1.3, contrast: 1.2, glare: .6 };
  let prev = s.brightness;
  for (let i = 0; i < 200; i++) { s = stepSettings(s, t, 33); assert.ok(s.brightness >= prev - 1e-12 && s.brightness <= 1.3); prev = s.brightness; }
  assert.ok(Math.abs(s.brightness - 1.3) < .03);
});

test("tone curve is identity at neutral, monotonic, and compresses highlights with glare cut", () => {
  for (const v of [0, .25, .5, .9, 1]) assert.ok(Math.abs(tone(v, NEUTRAL) - v) < 1e-9);
  const g = { brightness: 1, contrast: 1, glare: 1 };
  let last = -1; for (let i = 0; i <= 100; i++) { const y = tone(i / 100, g); assert.ok(y >= last); last = y; }
  assert.ok(tone(.95, g) < .9); assert.equal(tone(.3, g), .3);
  const lut = buildLut(NEUTRAL); assert.equal(lut[0], 0); assert.equal(lut[128], 128); assert.equal(lut[255], 255);
});

test("display filter is a softer approximation and empty at neutral", () => {
  assert.equal(displayFilter(NEUTRAL), "");
  assert.equal(displayFilter({ brightness: 1.4, contrast: 1.2, glare: .5 }), "brightness(1.200) contrast(1.100)");
});

test("prefs persist per laptop and tolerate bad storage", () => {
  const m = new Map(); const store = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.deepEqual(loadLightPrefs(store), { auto: true, manual: { ...NEUTRAL } });
  saveLightPrefs({ auto: false, manual: { brightness: 1.2, contrast: 9, glare: .4 } }, store);
  assert.deepEqual(loadLightPrefs(store), { auto: false, manual: { brightness: 1.2, contrast: LIMITS.contrast[1], glare: .4 } });
  m.set("pob-light-settings", "{bad"); assert.equal(loadLightPrefs(store).auto, true);
  assert.equal(loadLightPrefs({ getItem() { throw Error(); } }).auto, true);
});

test("camera constraints are applied only when supported and never throw", async () => {
  const applied = [];
  const track = { getCapabilities: () => ({ exposureMode: ["manual", "continuous"], whiteBalanceMode: ["continuous"] }),
    applyConstraints: async c => applied.push(c) };
  assert.equal(await applyCameraLightConstraints(track), true);
  assert.deepEqual(applied[0], { advanced: [{ exposureMode: "continuous", whiteBalanceMode: "continuous" }] });
  assert.equal(await applyCameraLightConstraints({ getCapabilities: () => ({}) }), false);
  assert.equal(await applyCameraLightConstraints({ getCapabilities: () => ({ exposureMode: ["continuous"] }), applyConstraints: async () => { throw Error(); } }), false);
  assert.equal(await applyCameraLightConstraints(undefined), false);
});

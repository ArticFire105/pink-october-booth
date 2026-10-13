import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraScreenState, isCameraScreen, onScreenChange } from '../js/effects-gate.js';
import { BALLOON_CONFIG, mergeSettings, pickPalette, sizeRange, driftPath, updateBalloon } from '../js/balloon-bloom.js';

test('settings validate storage input, clamp bounds and preserve untouched options', () => {
  assert.equal(BALLOON_CONFIG.palette, 'Pink');
  assert.equal(BALLOON_CONFIG.mode, 'float');
  assert.equal(BALLOON_CONFIG.paperTint, true);
  assert.equal(BALLOON_CONFIG.dotGrid, false);
  const settings = mergeSettings({ mode: 'bad', palette: '__proto__', enabled: 'false', scale: 99,
    fadeTime: -1, maxBalloons: 3.9, gloss: NaN, customColors: ['red', '#abcdef', null] });
  assert.equal(settings.mode, 'float');
  assert.equal(settings.palette, 'Pink');
  assert.equal(settings.enabled, true);
  assert.equal(settings.scale, 2);
  assert.equal(settings.fadeTime, 500);
  assert.equal(settings.maxBalloons, 3);
  assert.equal(settings.gloss, BALLOON_CONFIG.gloss);
  assert.deepEqual(settings.customColors, ['#abcdef']);
  assert.equal(mergeSettings({ mode: 'drift' }, settings).scale, 2);
  assert.deepEqual(mergeSettings(null), BALLOON_CONFIG);
});

test('palette selection and height ranges are bounded and varied', () => {
  for (const palette of ['Pink', 'Mixed pinks', 'Warm pinks', 'Cool pinks']) {
    const settings = mergeSettings({ palette });
    assert.match(pickPalette(settings, 0), /^#[0-9a-f]{6}$/i);
    assert.notEqual(pickPalette(settings, 0), pickPalette(settings, 1));
  }
  assert.equal(pickPalette(mergeSettings({ customColors: ['#123456'] }), 1), '#123456');
  assert.deepEqual(sizeRange(), [40, 90]);
  assert.deepEqual(sizeRange(1.5), [60, 135]);
  assert.deepEqual(sizeRange(NaN), [40, 90]);
});

test('drift begins at origin, sways with age; float stays upright on a straight rise', () => {
  assert.equal(driftPath(0, 1), 0);
  assert.notEqual(driftPath(400, 1), driftPath(1200, 1));
  const b = { originX: 10, originY: 200, born: 0, duration: 2200, rise: 100, phase: 1 };
  assert.equal(updateBalloon({ ...b, mode: 'float' }, 500).x, 10);
  assert.equal(updateBalloon({ ...b, mode: 'drift' }, 1100).x, 10 + driftPath(500, 1));
});

test('camera gate blocks visible stage or live stream and permits camera-free results', () => {
  assert.equal(cameraScreenState(), false);
  assert.equal(cameraScreenState({ stageVisible: true }), true);
  assert.equal(cameraScreenState({ cameraActive: true }), true);
  const stage = { hidden: true };
  const track = { readyState: 'ended' };
  const doc = { getElementById: () => stage, querySelectorAll: () => [
    { srcObject: { getVideoTracks: () => [track] } },
  ] };
  assert.equal(isCameraScreen(doc), false);
  stage.hidden = false;
  assert.equal(isCameraScreen(doc), true);
  stage.hidden = true;
  track.readyState = 'live';
  assert.equal(isCameraScreen(doc), true);
});

test('screen observer watches stage and home and disconnects cleanly', () => {
  const original = globalThis.MutationObserver;
  let notify, disconnected = false;
  const observed = [];
  globalThis.MutationObserver = class {
    constructor(cb) { notify = cb; }
    observe(el, options) { observed.push([el, options.attributeFilter]); }
    disconnect() { disconnected = true; }
  };
  try {
    const stage = { hidden: true }, home = { hidden: false };
    const doc = { getElementById: id => id === 'stage' ? stage : home };
    const changes = [];
    const unsubscribe = onScreenChange(value => changes.push(value), doc);
    stage.hidden = false;
    notify();
    assert.deepEqual(changes, [false, true]);
    assert.deepEqual(observed, [[stage, ['hidden']], [home, ['hidden']]]);
    unsubscribe();
    assert.equal(disconnected, true);
  } finally {
    if (original) globalThis.MutationObserver = original;
    else delete globalThis.MutationObserver;
  }
});

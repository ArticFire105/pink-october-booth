import test from 'node:test';
import assert from 'node:assert/strict';
import { MUTE_KEY, readMuted, writeMuted } from '../js/finish-effects.js';
test('mute defaults off and persists either choice', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(readMuted(storage), false);
  writeMuted(storage, true);
  assert.equal(values.get(MUTE_KEY), 'true');
  assert.equal(readMuted(storage), true);
  writeMuted(storage, false);
  assert.equal(readMuted(storage), false);
});
test('unavailable storage never blocks finishing', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.equal(readMuted(storage), false);
  assert.doesNotThrow(() => writeMuted(storage, true));
  assert.equal(readMuted(), false);
});

test('finish plays quiet bounded audio, mute suppresses it, reduced motion suppresses animation', async () => {
  const { setupFinishEffects } = await import('../js/finish-effects.js');
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const events = {}, changes = {};
  const notes = [], ramps = [];
  let animations = 0, reduced = false;
  class Audio {
    state = 'running'; currentTime = 2; destination = {};
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime: value => ramps.push(value), exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() { return { frequency: {}, connect() {}, disconnect() {}, start: time => notes.push(time), stop: time => notes.push(time) }; }
  }
  try {
    globalThis.window = { AudioContext: Audio, matchMedia: () => ({ matches: reduced }) };
    globalThis.document = { addEventListener: (name, callback) => { events[name] = callback; } };
    const toggle = { addEventListener: (name, callback) => { changes[name] = callback; } };
    const finish = setupFinishEffects(toggle, { animate: () => animations++ });
    events.pointerdown();
    finish();
    assert.deepEqual(notes, [2, 2.6]);
    assert.deepEqual(ramps, [.025]);
    assert.equal(animations, 1);
    toggle.checked = true; changes.change(); reduced = true;
    finish();
    assert.equal(notes.length, 2);
    assert.equal(animations, 1);
  } finally {
    globalThis.window = oldWindow; globalThis.document = oldDocument;
  }
});

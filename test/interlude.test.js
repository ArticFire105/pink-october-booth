import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterlude, shouldPlayInterlude, INTERLUDE } from '../js/interlude.js';

test('interlude runs hold -> video -> reveal -> end -> done', () => {
  const s = createInterlude(0);
  assert.equal(s.update(500).phase, 'hold');
  assert.equal(s.update(1000).phase, 'video');
  assert.equal(s.update(4000, { videoTime: 3 }).phase, 'video');
  const r = s.update(6100, { videoTime: 6.0 });
  assert.equal(r.phase, 'reveal'); assert.equal(r.reveal, 0);
  assert.ok(Math.abs(s.update(6100 + INTERLUDE.revealMs / 2, { videoTime: 6.4 }).reveal - .5) < 1e-9);
  assert.equal(s.update(6100 + INTERLUDE.revealMs, { videoTime: 6.8 }).phase, 'end');
  assert.equal(s.update(6100 + INTERLUDE.revealMs + 999).phase, 'end');
  const d = s.update(6100 + INTERLUDE.revealMs + 1000);
  assert.equal(d.phase, 'done'); assert.equal(d.reveal, 1);
});

test('reveal follows video time, not wall clock (slow load waits)', () => {
  const s = createInterlude(0);
  s.update(1000);
  assert.equal(s.update(20000, { videoTime: 2 }).phase, 'video');
  assert.equal(s.update(20001).phase, 'video');
});

test('thumbs-up skips only after an open hand was seen, held 500ms', () => {
  const s = createInterlude(0);
  s.update(1000);
  s.update(1100, { thumbsUp: true }); s.update(2000, { thumbsUp: true });
  assert.equal(s.phase, 'video');
  s.update(2100, { handOpen: true });
  s.update(2200, { thumbsUp: true });
  assert.equal(s.update(2600, { thumbsUp: true }).phase, 'video');
  const r = s.update(2700, { thumbsUp: true });
  assert.equal(r.phase, 'end'); assert.equal(r.reveal, 1);
  assert.equal(s.update(3700).phase, 'done');
});

test('releasing thumbs resets the hold; skip button jumps to end', () => {
  const s = createInterlude(0);
  s.update(1000, { handOpen: true });
  s.update(1100, { thumbsUp: true }); s.update(1400); s.update(1500, { thumbsUp: true });
  assert.equal(s.update(1900, { thumbsUp: true }).phase, 'video');
  const b = createInterlude(0); b.update(1000); b.skip(1200);
  assert.equal(b.phase, 'end'); assert.equal(b.update(2200).phase, 'done');
});

test('failure and reduced motion bypass the video', () => {
  assert.equal(shouldPlayInterlude({ reduceMotion: true }), false);
  assert.equal(shouldPlayInterlude({ videoOk: false }), false);
  assert.equal(shouldPlayInterlude({}), true);
  const s = createInterlude(0); s.fail();
  const st = s.update(10);
  assert.equal(st.done, true); assert.equal(st.reveal, 0); assert.equal(s.failed, true);
});

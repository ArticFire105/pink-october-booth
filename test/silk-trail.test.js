import test from 'node:test';
import assert from 'node:assert/strict';
import { step, taperWidth, fadeAlpha, POINT_COUNT, FADE_MS, setupSilkTrail, SILK_ENABLED } from '../js/silk-trail.js';

test('chain follows with inertia without mutating its input and settles', () => {
  const original = Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  const target = { x: 100, y: 50 };
  let points = step(original, target);
  assert.equal(original[0].x, 0);
  assert.ok(points[0].x > points[1].x);
  assert.ok(points[1].x > points[2].x);
  assert.ok(points[0].x < target.x);
  const drifting = step(points, { x: points[0].x, y: points[0].y });
  assert.ok(drifting[0].x > points[0].x);
  for (let i = 0; i < 1000; i++) points = step(points, target);
  for (const point of points) {
    assert.ok(Math.abs(point.x - target.x) < 0.001);
    assert.ok(Math.abs(point.y - target.y) < 0.001);
  }
  assert.deepEqual(step(original, target, 0.28, 0), original);
});

test('width tapers to zero and speed response is capped', () => {
  assert.ok(taperWidth(0, 10) > taperWidth(0, 0));
  assert.ok(taperWidth(0.2, 10) > taperWidth(0.8, 10));
  assert.equal(taperWidth(1, 20), 0);
  assert.equal(taperWidth(2, 20), 0);
  assert.equal(taperWidth(0, 1e6), taperWidth(0, 24));
  assert.equal(taperWidth(0, -1), taperWidth(0, 0));
});

test('fade fully clears after 500 ms and clamps at both ends', () => {
  assert.equal(FADE_MS, 500);
  assert.equal(fadeAlpha(-100), 1);
  assert.equal(fadeAlpha(0), 1);
  assert.equal(fadeAlpha(250), 0.25);
  assert.equal(fadeAlpha(500), 0);
  assert.equal(fadeAlpha(5000), 0);
});

test('reduced motion returns before any DOM access or listeners', () => {
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  try { assert.equal(setupSilkTrail({ enabled: true }), undefined); }
  finally { delete globalThis.window; }
});

test('site-wide lifecycle sleeps when idle, pauses on tab hide, caps DPR at 1.5 and cleans up', () => {
  const saved = new Map(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const events = () => ({ handlers: {}, addEventListener(k, fn) { this.handlers[k] = fn; }, removeEventListener(k) { delete this.handlers[k]; } });
  const context = new Proxy({}, { get: (obj, key) => obj[key] || (() => {}) });
  context.createLinearGradient = () => ({ addColorStop() {} });
  const canvas = { setAttribute() {}, getContext: () => context, remove() { this.removed = true; } };
  const reduce = { ...events(), matches: false };
  const stage = { hidden: true };
  const pending = new Map(); let next = 0;
  globalThis.window = { ...events(), matchMedia: () => reduce, devicePixelRatio: 3, innerWidth: 800, innerHeight: 600 };
  globalThis.document = { ...events(), hidden: false, body: { append() {} }, createElement: () => canvas, getElementById: id => id === 'stage' ? stage : null };
  globalThis.requestAnimationFrame = fn => { pending.set(++next, fn); return next; };
  globalThis.cancelAnimationFrame = id => pending.delete(id);
  const runFrame = now => { const [id, fn] = pending.entries().next().value; pending.delete(id); fn(now); };
  try {
    setupSilkTrail({ enabled: true });
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 900);
    assert.equal(pending.size, 0);
    window.handlers.pointermove({ clientX: 50, clientY: 60, isPrimary: true });
    assert.equal(pending.size, 1);
    runFrame(performance.now() + 16);
    assert.equal(pending.size, 1);
    runFrame(performance.now() + 600);
    assert.equal(pending.size, 0, 'no drawing while the pointer is still');
    window.handlers.pointermove({ clientX: 80, clientY: 70, isPrimary: true });
    stage.hidden = false;
    document.handlers.playing();
    assert.equal(pending.size, 0, 'opening camera cancels scheduled animation');
    assert.equal(canvas.hidden, true);
    window.handlers.pointermove({ clientX: 500, clientY: 100, isPrimary: true });
    assert.equal(pending.size, 0, 'camera pointer events are ignored');
    stage.hidden = true;
    document.handlers.emptied();
    assert.equal(canvas.hidden, false);
    document.hidden = true;
    document.handlers.visibilitychange();
    assert.equal(pending.size, 0);
    assert.equal(canvas.hidden, true);
    document.hidden = false;
    document.handlers.visibilitychange();
    assert.equal(canvas.hidden, false);
    reduce.matches = true;
    reduce.handlers.change();
    assert.equal(canvas.removed, true);
    assert.deepEqual(window.handlers, {});
    assert.deepEqual(document.handlers, {});
    assert.deepEqual(reduce.handlers, {});
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

import { anchorHead } from "../js/silk-trail.js";
test("silk head is pinned to the cursor hotspot", () => {
  const pts = [{ x: 0, y: 0, vx: 3, vy: 3 }, { x: 5, y: 5 }];
  const out = anchorHead(pts, { x: 40, y: 60 });
  assert.deepEqual(out[0], { x: 40, y: 60, vx: 0, vy: 0 });
  assert.deepEqual(out[1], { x: 5, y: 5 });
  assert.equal(anchorHead(pts, null), pts);
});

test('silk is on by default and can be disabled without touching the DOM', () => {
  assert.equal(SILK_ENABLED, true);
  assert.equal(setupSilkTrail({ enabled: false }), undefined);
});


test('touch and coarse-pointer devices install no silk canvas or listeners', () => {
  globalThis.window = {
    matchMedia: query => ({ matches: query === '(hover: none), (pointer: coarse)' }),
  };
  try { assert.equal(setupSilkTrail(), undefined); }
  finally { delete globalThis.window; }
});

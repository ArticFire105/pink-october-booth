import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnThrottle, updateBalloon, capBalloons, setupBalloonBloom, revealProgress, lifecyclePhase, spriteCacheKey, mergeSettings, renderPreviewFrame } from '../js/balloon-bloom.js';

test('distance throttle accumulates turns, accepts exact threshold and avoids bursts', () => {
  const first = spawnThrottle(null, { x: 0, y: 0 });
  const next = spawnThrottle(first, { x: 40, y: 0 });
  assert.equal(first.distance, 0);
  assert.equal(next.spawn, false);
  const turn = spawnThrottle(next, { x: 40, y: 40 });
  assert.equal(turn.spawn, true);
  assert.equal(turn.distance, 0);
  const jump = spawnThrottle(turn, { x: 2000, y: 40 });
  assert.equal(jump.spawn, true);
  assert.equal(spawnThrottle(jump, jump.point).spawn, false);
  assert.equal(spawnThrottle(first, { x: 80, y: 0 }, 160).spawn, false);
});

test('balloons bloom, rise, fade and expire without mutating their origin', () => {
  const original = { originX: 20, originY: 100, born: 100, duration: 2000, rise: 100, phase: 0 };
  const start = updateBalloon(original, 100);
  assert.equal(start.alpha, 0);
  assert.equal(start.scale, 1);
  assert.equal(start.lifecycle, 'paint');
  assert.equal(start.y, 100);
  const grown = updateBalloon(start, 700);
  assert.equal(grown.y, 100);
  assert.equal(grown.reveal, 1);
  assert.equal(grown.scale, 1);
  assert.ok(grown.alpha > 0);
  const later = updateBalloon(grown, 2300);
  assert.ok(later.alpha < grown.alpha);
  assert.ok(later.y < grown.y);
  assert.deepEqual(later, updateBalloon(original, 2300), 'refresh-rate independent');
  const end = updateBalloon(original, 2700);
  assert.equal(end.alive, false);
  assert.equal(end.alpha, 0);
  assert.equal(updateBalloon(original, 9999).alpha, 0);
  assert.equal(updateBalloon(original, 0).age, 0);
  assert.equal(original.age, undefined);
});

test('cap keeps newest balloons and supports the lighter six-balloon mode', () => {
  const original = Array.from({ length: 15 }, (_, i) => i);
  assert.deepEqual(capBalloons(original), original.slice(5));
  assert.deepEqual(capBalloons(original, 6), original.slice(9));
  assert.deepEqual(capBalloons(original, 0), []);
  assert.equal(original.length, 15);
});

test('reduced motion installs nothing', () => {
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  globalThis.document = { getElementById: () => null };
  try { assert.equal(typeof setupBalloonBloom(), 'function'); }
  finally { delete globalThis.window; delete globalThis.document; }
});

test('canvas lifecycle is passive, bounded, idle-aware and excludes controls', () => {
  const keys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = new Map(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const events = () => ({ handlers: {}, addEventListener(k, fn, options) {
    this.handlers[k] = fn;
    if (k === 'pointermove') assert.equal(options.passive, true);
  }, removeEventListener(k) { delete this.handlers[k]; } });
  let painted = 0, created = 0, frameActive = false;
  const controls = ['enabled', 'palette', 'mode', 'scale'].map(key => ({ ...events(),
    dataset: { balloonSetting: key }, type: key === 'enabled' ? 'checkbox' : 'select' }));
  const context = () => new Proxy({ drawImage() { if (frameActive) painted++; } }, {
    get: (obj, key) => obj[key] ?? (() => {
      if (frameActive && ['ellipse', 'fill', 'stroke', 'fillRect', 'createRadialGradient'].includes(key))
        assert.fail(`expensive frame operation: ${key}`);
    }),
    set(obj, key, value) {
      assert.ok(!['filter', 'shadowBlur'].includes(key), 'no runtime blur');
      obj[key] = value; return true;
    },
  });
  function makeCanvas() {
    created++;
    const ctx = context();
    return { ownerDocument: globalThis.document, setAttribute(k, v) { this[k] = v; },
      getContext: () => ctx, remove() { this.removed = true; } };
  }
  let canvas;
  const home = { hidden: false };
  const reduce = { ...events(), matches: false };
  const stage = { hidden: true };
  const pending = new Map();
  let id = 0;
  globalThis.window = { ...events(), matchMedia: () => reduce, devicePixelRatio: 3, innerWidth: 800, innerHeight: 600 };
  globalThis.document = { ...events(), hidden: false, body: { append(c) { canvas = c; } }, createElement: makeCanvas, querySelectorAll: selector => selector === '[data-balloon-setting]' ? controls : [], getElementById: id => id === 'home' ? home : id === 'stage' ? stage : null };
  globalThis.requestAnimationFrame = fn => { pending.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = id => pending.delete(id);
  const run = now => { const [id, fn] = pending.entries().next().value; pending.delete(id); painted = 0; frameActive = true; try { fn(now); } finally { frameActive = false; } };
  const move = (x, interactive = false) => window.handlers.pointermove({ clientX: x, clientY: 100, isPrimary: true,
    target: { closest(selector) { assert.equal(selector, 'button, a, input, select, summary, [role=button]'); return interactive; } } });
  try {
    setupBalloonBloom();
    assert.equal(canvas['aria-hidden'], 'true');
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 900);
    assert.equal(pending.size, 0);
    window.handlers.pointerdown({ type: 'pointerdown', clientX: 20, clientY: 30, isPrimary: true });
    assert.equal(pending.size, 1, 'a tap spawns without pointer travel');
    window.handlers.pointerout({ relatedTarget: null });
    assert.equal(pending.size, 0, 'leaving the window clears balloons');
    move(0); move(100, true); move(200);
    assert.equal(pending.size, 0);
    move(280);
    assert.equal(pending.size, 1);
    for (let x = 360; x < 2000; x += 80) move(x);
    run(performance.now() + 16);
    assert.equal(painted, 50, 'ten painting balloons: four wash blits and one string each');
    home.hidden = true;
    run(performance.now() + 32);
    assert.equal(painted, 50, 'non-camera results retain the ten-balloon cap');
    run(performance.now() + 2900);
    assert.equal(pending.size, 0);
    window.handlers.resize();
    move(0); move(59);
    assert.equal(pending.size, 0, 'distance below 60px does not spawn');
    move(60);
    assert.equal(pending.size, 1);
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
    move(400);
    assert.equal(pending.size, 0);
    document.hidden = false;
    document.handlers.visibilitychange();
    assert.equal(canvas.hidden, false);
    move(0); move(160);
    window.handlers.resize();
    assert.equal(pending.size, 0);
    const change = (key, value) => {
      const control = controls.find(c => c.dataset.balloonSetting === key);
      if (key === 'enabled') control.checked = value; else control.value = value;
      control.handlers.change({ currentTarget: control });
    };
    change('enabled', false);
    move(0); move(100);
    assert.equal(pending.size, 0);
    assert.equal(canvas.hidden, true);
    change('enabled', true);
    assert.equal(canvas.hidden, false);
    change('palette', 'Cool pinks');
    change('scale', '2');
    change('mode', 'drift');
    const before = created;
    move(0); move(60);
    assert.ok(created > before, 'new settings generate fresh sprites');
    assert.equal(controls.find(c => c.dataset.balloonSetting === 'mode').value, 'drift');
    const cached = created;
    run(performance.now() + 700);
    assert.equal(created, cached, 'frames never create canvases');
    assert.equal(painted, 2, 'completed paint uses just body and string');
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

test('reveal and lifecycle have exact paint, float, fade and expiry boundaries', () => {
  assert.equal(revealProgress(-50), 0);
  assert.equal(revealProgress(300), 0.5);
  assert.equal(revealProgress(600), 1);
  assert.equal(revealProgress(900), 1);
  assert.equal(revealProgress(250, 500), 0.5);
  assert.equal(lifecyclePhase(599, 2000), 'paint');
  assert.equal(lifecyclePhase(600, 2000), 'float');
  assert.equal(lifecyclePhase(1800, 2000), 'fade');
  assert.equal(lifecyclePhase(2600, 2000), 'dead');
  const b = { originX: 20, originY: 100, born: 0, duration: 500, rise: 100, phase: 1, mode: 'drift' };
  assert.equal(updateBalloon(b, 500).x, 20, 'no drift before painting completes');
  assert.equal(updateBalloon(b, 500).y, 100);
  assert.equal(updateBalloon(b, 1099).alive, true, 'short fadeTime still allows full paint-in');
  assert.equal(updateBalloon(b, 1100).alive, false);
  assert.deepEqual(capBalloons(Array.from({ length: 40 }, (_, i) => i), 40),
    Array.from({ length: 10 }, (_, i) => i + 30));
  assert.equal(spawnThrottle(spawnThrottle(null, { x: 0, y: 0 }), { x: 60, y: 0 }).spawn, true);
});

test('sprite keys track artwork settings, size, colour and variant but not motion', () => {
  const settings = mergeSettings();
  const key = spriteCacheKey(settings);
  for (const patch of [{ palette: 'Cool pinks' }, { scale: 2 }, { customColors: ['#123456'] }, { watercolor: 1 }])
    assert.notEqual(spriteCacheKey(mergeSettings(patch)), key);
  assert.equal(spriteCacheKey(mergeSettings({ mode: 'drift', enabled: false })), key);
  assert.notEqual(spriteCacheKey(settings, 1), key);
  assert.notEqual(spriteCacheKey(settings, 0, '#123456'), key);
  assert.notEqual(spriteCacheKey(settings, 0, undefined, 1), key);
});

test('headless preview lazily reuses sprites and invalidates palette and size', () => {
  let created = 0, blits = 0;
  const ctx = new Proxy({ drawImage() { blits++; } }, { get: (o, k) => o[k] ?? (() => {}) });
  const ownerDocument = { createElement() { created++; return { getContext: () => ctx }; } };
  const canvas = { width: 500, height: 400, ownerDocument, getContext: () => ctx };
  assert.equal(renderPreviewFrame(canvas), canvas);
  assert.equal(created, 6, 'one body and string for each of three preview sprites');
  assert.equal(blits, 15);
  renderPreviewFrame(canvas, {}, 400);
  assert.equal(created, 6, 'later frames reuse the rasterized artwork');
  renderPreviewFrame(canvas, { mode: 'drift' }, 900);
  assert.equal(created, 6, 'motion does not invalidate artwork');
  renderPreviewFrame(canvas, { palette: 'Cool pinks' });
  assert.equal(created, 12);
  renderPreviewFrame(canvas, { palette: 'Cool pinks', scale: 2 });
  assert.equal(created, 18);
  blits = 0;
  renderPreviewFrame(canvas, { enabled: false });
  assert.equal(blits, 0);
});

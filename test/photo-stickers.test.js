import test from 'node:test';
import assert from 'node:assert/strict';
import { boundsOf, layoutStickers, stickerBounds, composePortrait } from '../js/photo-stickers.js';

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

test('stickers avoid padded faces, heart strokes and each other at all portrait sizes', () => {
  for (const width of [180, 720, 1080, 2160]) {
    const height = width * 16 / 9;
    for (const left of [0, .1, .3, .6, .85]) {
      const face = { x: width * left, y: height * .1, width: width * .45, height: height * .5 };
      const heart = { x: width * .65, y: height * .3, width: width * .3, height: width * .3 };
      const items = layoutStickers(width, height, face, heart);
      assert.ok(items.length <= 8);
      const occupied = [face, heart];
      for (const item of items) {
        const b = stickerBounds(item);
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height);
        assert.ok(occupied.every(other => !overlaps(b, other)));
        occupied.push(b);
      }
      assert.deepEqual(items, layoutStickers(width, height, face, heart));
    }
  }
});

test('no face falls back to edges with ribbon, tag, stamp, tape and four accents', () => {
  const items = layoutStickers(1080, 1920, null, null);
  assert.equal(items.length, 8);
  const tape = items.find(item => item.type === 'tape');
  assert.ok(stickerBounds(tape).y < 22);
  for (const type of ['ribbon', 'tag', 'stamp', 'tape']) assert.ok(items.some(s => s.type === type));
  for (const item of items) {
    const b = stickerBounds(item);
    assert.ok(Math.min(b.x, b.y, 1080 - b.x - b.width, 1920 - b.y - b.height) < 22);
  }
});

test('safety wins over decoration when the face fills the frame', () => {
  assert.deepEqual(layoutStickers(1080, 1920, { x: 0, y: 0, width: 1080, height: 1920 }), []);
  assert.deepEqual(layoutStickers(0, 1920), []);
});

test('landmark bounds ignore invalid points and add 15 percent on every side', () => {
  assert.deepEqual(boundsOf([{ x: 100, y: 200 }, { x: 300, y: 600 }, { x: NaN }], .15),
    { x: 70, y: 140, width: 260, height: 520 });
  assert.equal(boundsOf([]), null);
});

test('portrait composition is DOM-free, insets the entire source and paints optional strokes', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: () => true });
  const canvas = { getContext: () => ctx }, source = { width: 1080, height: 1920 };
  assert.equal(composePortrait(canvas, source, null, [[{ x: 700, y: 500 }, { x: 850, y: 650 }]]), canvas);
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1920);
  assert.deepEqual(calls.find(c => c[0] === 'drawImage'), ['drawImage', source, 54, 37.800000000000004, 972, 1728]);
  assert.ok(calls.some(c => c[0] === 'lineTo' && c[1] === 850));
  assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'Pink October'));
  assert.ok(calls.some(c => c[0] === 'fillText' && c[1] === 'GDG MAHE Dubai'));
});

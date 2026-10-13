import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeart, placeHeart } from '../js/heart-placement.js';

function face(left = 400, right = 600, top = 200) {
  const marks = [];
  marks[234] = { x: left, y: 300 }; marks[454] = { x: right, y: 300 };
  marks[10] = { x: (left + right) / 2, y: top };
  return marks;
}
test('normalization preserves actual stroke geometry, all samples and breaks', () => {
  const strokes = [[{ x: 10, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 60 }],
    [{ x: 20, y: 40 }, { x: 10, y: 60 }]];
  const original = structuredClone(strokes);
  const normalized = normalizeHeart(strokes);
  assert.deepEqual(normalized.map(s => s.length), [3, 2]);
  assert.deepEqual(normalized[0], [{ x: .25, y: 0 }, { x: .75, y: 0 }, { x: .75, y: 1 }]);
  assert.deepEqual(strokes, original);
  assert.deepEqual(normalizeHeart([]), []);
  assert.deepEqual(normalizeHeart([[{ x: 1, y: 1 }, { x: 1, y: 1 }]]), []);
});
test('heart sits beside the head, tracks face width and remains within the frame', () => {
  const stroke = [[{ x: 0, y: 0 }, { x: 1, y: 1 }]];
  const placed = placeHeart(stroke, face(), 1000, 800)[0];
  assert.ok(placed[0].x > 600);
  assert.equal(placed[1].x - placed[0].x, 160);
  const larger = placeHeart(stroke, face(350, 650), 1000, 800)[0];
  assert.equal(larger[1].x - larger[0].x, 240);
  const nearEdge = placeHeart(stroke, face(800, 990, -20), 1000, 800)[0];
  assert.ok(nearEdge[1].x < 800);
  for (const marks of [face(-100, 300, 790), face(800, 1200, -200)]) {
    for (const p of placeHeart(stroke, marks, 1000, 800).flat()) {
      assert.ok(p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 800);
    }
  }
  assert.deepEqual(placeHeart(stroke, [], 1000, 800), []);
  assert.deepEqual(placeHeart([], face(), 1000, 800), []);
  assert.deepEqual(placeHeart(stroke, face(), 0, 800), []);
});

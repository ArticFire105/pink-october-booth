import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsHalf, halfCoverage } from '../js/team.js';

const target = [{ x: -2, y: 0 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 0 }];
test('half boundaries share the centre and reject the opposite half', () => {
  assert.equal(acceptsHalf({ x: 0 }, 'left', 0), true);
  assert.equal(acceptsHalf({ x: 0 }, 'right', 0), true);
  assert.equal(acceptsHalf({ x: 1 }, 'left', 0), false);
  assert.equal(acceptsHalf({ x: -1 }, 'right', 0), false);
});
test('coverage measures each half independently, including empty ink', () => {
  assert.deepEqual(halfCoverage([], target, 0, .01), { left: 0, right: 0 });
  assert.deepEqual(halfCoverage([target.slice(0, 2)], target, 0, .01), { left: 100, right: 0 });
  assert.deepEqual(halfCoverage([target.slice(0, 2), target.slice(2)], target, 0, .01), { left: 100, right: 100 });
  assert.deepEqual(halfCoverage([], [], 0, .01), { left: 0, right: 0 });
});
test('coverage includes segment interiors but never joins separate strokes', () => {
  const guide = [{ x: -1, y: 0 }];
  assert.equal(halfCoverage([[{ x: -2, y: 0 }, { x: 0, y: 0 }]], guide, 0, .01).left, 100);
  assert.equal(halfCoverage([[{ x: -2, y: 0 }], [{ x: 0, y: 0 }]], guide, 0, .01).left, 0);
});

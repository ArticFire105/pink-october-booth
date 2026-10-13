import test from 'node:test';
import assert from 'node:assert/strict';
import { counterTick } from '../js/landing-motion.js';

test('landing counter starts at zero, increases monotonically, and ends at the tally', () => {
  for (const total of [0, 1, 8, 137, 10000]) {
    const values = Array.from({ length: 101 }, (_, i) => counterTick(total, i / 100));
    assert.equal(values[0], 0);
    assert.equal(values.at(-1), total);
    assert.ok(values.every((v, i) => Number.isInteger(v) && v <= total && (i === 0 || v >= values[i - 1])));
  }
});

test('landing counter clamps time and rejects invalid tallies', () => {
  assert.equal(counterTick(10, -1), 0);
  assert.equal(counterTick(10, 2), 10);
  assert.equal(counterTick(10, NaN), 0);
  for (const total of [-1, NaN, Infinity, 1.5, '10']) assert.equal(counterTick(total, .5), 0);
});

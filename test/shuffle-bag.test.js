import test from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, nextFromBag } from '../js/shuffle-bag.js';
import { FACTS, FACTS_KEY, createFactBag } from '../js/awareness-facts.js';

test('pure bag exhausts the entire pool before refilling and does not mutate state', () => {
  let remaining = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    const seen = [];
    for (let i = 0; i < 8; i++) {
      const before = [...remaining];
      const draw = nextFromBag(8, remaining, () => .25);
      assert.deepEqual(remaining, before);
      seen.push(draw.index);
      remaining = draw.remaining;
    }
    assert.equal(new Set(seen).size, 8);
    assert.deepEqual(remaining, []);
  }
  assert.throws(() => nextFromBag(0), RangeError);
  assert.notDeepEqual(shuffle([0, 1, 2, 3], () => 0), shuffle([0, 1, 2, 3], () => .99));
});
test('fact rotation continues across reloads and works without storage', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const seen = [];
  for (let i = 0; i < FACTS.length; i++) seen.push(createFactBag(storage, () => .3).next());
  assert.deepEqual(new Set(seen), new Set(FACTS));
  assert.deepEqual(JSON.parse(values.get(FACTS_KEY)), []);
  for (const storage of [undefined, { getItem() { throw Error(); }, setItem() { throw Error(); } }]) {
    const bag = createFactBag(storage);
    assert.equal(new Set(Array.from({ length: FACTS.length }, () => bag.next())).size, FACTS.length);
  }
});
test('invalid saved bags reset safely', () => {
  for (const raw of ['oops', '{}', '[0,0]', '[-1]', '[99]', 'null']) {
    const bag = createFactBag({ getItem: () => raw, setItem() {} });
    assert.equal(new Set(Array.from({ length: FACTS.length }, () => bag.next())).size, FACTS.length);
  }
});

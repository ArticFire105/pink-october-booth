import test from "node:test";
import assert from "node:assert/strict";
import { landmarkBox, createPlayerLock, selectPlayerHands, mostCentral } from "../js/player-select.js";

const box = (x, y, size = .2) => ({ x, y, size, top: y - size / 2, bottom: y + size / 2 });
const hand = (x, y) => [{ x, y }];

test("landmarkBox gives centre and size", () => {
  const b = landmarkBox([{ x: .4, y: .3 }, { x: .6, y: .5 }]);
  assert.ok(Math.abs(b.x - .5) < 1e-9 && Math.abs(b.y - .4) < 1e-9 && Math.abs(b.size - .2) < 1e-9);
});

test("most central face wins; larger face breaks near-ties", () => {
  assert.equal(mostCentral([box(.15, .5), box(.52, .5), box(.85, .5)]), 1);
  assert.equal(mostCentral([box(.45, .5, .1), box(.55, .5, .3)]), 1);
});

test("lock keeps the same player when someone else is only slightly more central", () => {
  const lock = createPlayerLock();
  assert.equal(lock.update([box(.4, .5), box(.75, .5)], 0), 0);
  // People swap order in the array and drift: still the same person (by position).
  assert.equal(lock.update([box(.78, .5), box(.42, .5)], 100), 1);
  assert.equal(lock.update([box(.40, .5), box(.55, .5)], 200), 0, "small advantage is ignored");
});

test("a clearly more central person takes over only after the switch delay", () => {
  const lock = createPlayerLock({ switchMs: 1000 });
  lock.update([box(.2, .5)], 0);
  assert.equal(lock.update([box(.2, .5), box(.5, .5)], 100), 0);
  assert.equal(lock.update([box(.2, .5), box(.5, .5)], 900), 0);
  assert.equal(lock.update([box(.2, .5), box(.5, .5)], 1100), 1);
  // The challenge timer resets if the advantage disappears.
  const l2 = createPlayerLock({ switchMs: 1000 });
  l2.update([box(.2, .5)], 0);
  l2.update([box(.2, .5), box(.5, .5)], 100);
  l2.update([box(.2, .5)], 600);
  assert.equal(l2.update([box(.2, .5), box(.5, .5)], 1200), 0);
});

test("brief loss (<0.5s) does not jump to another person; longer loss re-picks", () => {
  const lock = createPlayerLock({ lostMs: 500 });
  lock.update([box(.5, .5)], 0);
  assert.equal(lock.update([box(.85, .5)], 300), -1, "other person ignored while main player briefly missing");
  assert.equal(lock.update([box(.5, .5), box(.85, .5)], 400), 0);
  assert.equal(lock.update([], 500), -1);
  assert.equal(lock.update([box(.85, .5)], 1100), 0, "after 0.5s gone, the other person is picked");
  lock.reset(); assert.equal(lock.locked, null);
});

test("hands near the chosen face are kept; a bystander's hands are dropped", () => {
  const face = box(.5, .35, .18);
  const hands = [hand(.95, .7), hand(.42, .7), hand(.06, .6), hand(.6, .65)];
  assert.deepEqual(selectPlayerHands(hands, { face }).sort(), [1, 3]);
});

test("without a face: the locked primary hand plus its partner only", () => {
  const hands = [hand(.1, .6), hand(.5, .6), hand(.68, .62), hand(.92, .6)];
  assert.deepEqual(selectPlayerHands(hands, { primary: 1 }), [1, 2]);
  assert.deepEqual(selectPlayerHands(hands, {}), [1, 2], "falls back to most central");
  assert.deepEqual(selectPlayerHands([hand(.1, .6)], { primary: 0 }), [0]);
});

test("team mode style selection keeps two most central hands from different players", () => {
  const hands = [hand(.05, .5), hand(.35, .5), hand(.65, .5), hand(.97, .5)];
  assert.deepEqual(selectPlayerHands(hands, { max: 2 }).sort(), [1, 2]);
});

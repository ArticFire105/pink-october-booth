import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey, heartsToday, recordDailyHeart } from '../js/daily-count.js';
import { createCounters, COUNTERS_KEY } from '../js/counters.js';
import { createHeartWall, normalizeStrokes, HEART_WALL_KEY } from '../js/heart-wall.js';
import { createIdleDemo } from '../js/idle-demo.js';
const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };
const drawing = [[{ x: 10, y: 20, face: 'discard' }, { x: 30, y: 60 }, { x: 50, y: 20 }]];

test('today uses local calendar date, rejects invalid counts and rolls over', () => {
  const today = new Date(2026, 9, 13, 23, 59);
  assert.equal(localDateKey(today), '2026-10-13');
  const daily = recordDailyHeart(null, today);
  assert.equal(heartsToday(daily, today), 1);
  assert.equal(heartsToday(daily, new Date(2026, 9, 14)), 0);
  assert.equal(recordDailyHeart(daily, new Date(2026, 9, 14)).draw, 1);
  for (const draw of [-1, NaN, '3', Infinity]) assert.equal(heartsToday({ date: localDateKey(today), draw }, today), 0);
});

test('counter daily tally persists, deduplicates, resets and migrates undated totals', () => {
  const storage = memory(); let date = new Date(2026, 9, 13);
  storage.setItem(COUNTERS_KEY, JSON.stringify({ version: 1, counts: { sessions: 8, draw: 8, quiz: 0, pledges: 0, exports: 0 }, active: null }));
  let counters = createCounters(storage, () => date);
  assert.equal(counters.today(), 0);
  counters.start(); counters.record('draw'); counters.record('draw');
  counters = createCounters(storage, () => date);
  assert.equal(counters.today(), 1);
  assert.equal(counters.snapshot().draw, 9);
  date = new Date(2026, 9, 14); assert.equal(counters.today(), 0);
  counters.nextVisitor(); counters.start(); counters.record('draw'); assert.equal(counters.today(), 1);
  counters.reset(); assert.equal(counters.today(), 0);
});

test('wall normalizes without changing source, preserves stroke breaks, strips metadata and caps samples', () => {
  const before = JSON.stringify(drawing);
  assert.deepEqual(normalizeStrokes(drawing), [[{ x: 0, y: 0 }, { x: .5, y: 1 }, { x: 1, y: 0 }]]);
  assert.equal(JSON.stringify(drawing), before);
  assert.equal(normalizeStrokes([...drawing, ...drawing]).length, 2);
  const long = [Array.from({ length: 10000 }, (_, x) => ({ x, y: x }))];
  assert.ok(normalizeStrokes(long)[0].length <= 129);
  assert.deepEqual(normalizeStrokes([[{ x: NaN, y: 1 }]]), []);
});

test('wall persists last eight, isolates snapshots and resets', () => {
  const storage = memory(); const wall = createHeartWall(storage);
  for (let i = 0; i < 12; i++) wall.add([[{ x: 0, y: 0 }, { x: 20, y: i }]]);
  assert.equal(wall.snapshot().length, 8);
  assert.equal(wall.snapshot()[0][0][1].y, .6); // first retained is i=4, centered vertically
  assert.deepEqual(createHeartWall(storage).snapshot(), wall.snapshot());
  wall.snapshot()[0][0][0].x = 999;
  assert.notEqual(wall.snapshot()[0][0][0].x, 999);
  assert.ok(!storage.getItem(HEART_WALL_KEY).includes('face'));
  wall.reset(); assert.deepEqual(createHeartWall(storage).snapshot(), []);
});

test('wall safely handles corrupt or unavailable storage', () => {
  for (const storage of [undefined, { getItem: () => 'bad', setItem() { throw Error(); } }, { getItem: () => '[null,{},[null]]', setItem() {} }]) {
    const wall = createHeartWall(storage); wall.add(drawing);
    assert.equal(wall.snapshot().length, 1); wall.reset(); assert.deepEqual(wall.snapshot(), []);
  }
});

test('idle demo waits thirty seconds and cancels on input, hand or leaving landing', () => {
  const idle = createIdleDemo();
  const visible = (now, landing = true, handDetected = false) => idle.visible({ now, landing, handDetected });
  idle.reset(100);
  assert.equal(visible(30099), false); assert.equal(visible(30100), true);
  idle.reset(30101); assert.equal(visible(30102), false);
  assert.equal(visible(70000, true, true), false);
  assert.equal(visible(70001), false);
  assert.equal(visible(110000, false), false);
  assert.equal(visible(110001), false); assert.equal(visible(140000), true);
});

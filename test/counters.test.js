import test from "node:test";
import assert from "node:assert/strict";
import { createCounters, COUNTERS_KEY } from "../js/counters.js";

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("counts deduplicate across retries, modes and reloads; next visitor starts on play", () => {
  const storage = memory();
  let counters = createCounters(storage);
  counters.record("draw");
  assert.equal(counters.snapshot().draw, 0);
  for (let visitor = 0; visitor < 10; visitor++) {
    counters.start();
    counters.start();
    for (const kind of ["draw", "quiz", "exports"]) {
      counters.record(kind);
      counters.record(kind);
    }
    counters = createCounters(storage);
    counters.start();
    counters.record("exports");
    counters.record("photo");
    assert.deepEqual(counters.snapshot(), { sessions: visitor + 1, draw: visitor + 1, quiz: visitor + 1, exports: visitor + 1 });
    counters.nextVisitor();
  }
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(COUNTERS_KEY))), ["version", "counts", "active", "daily"]);
  assert.equal(counters.csv(), "metric,count\r\nsessions,10\r\ndraw,10\r\nquiz,10\r\nexports,10\r\n");
});

test("preview does not count as export; reset persists and clears deduplication", () => {
  const storage = memory();
  const counters = createCounters(storage);
  counters.start();
  counters.record("quiz");
  assert.equal(counters.snapshot().pledges, undefined);
  assert.equal(counters.snapshot().exports, 0);
  counters.reset();
  assert.deepEqual(createCounters(storage).snapshot(), { sessions: 0, draw: 0, quiz: 0, exports: 0 });
  counters.start();
  counters.record("quiz");
  assert.equal(counters.snapshot().quiz, 1);
});

test("unavailable, failed and corrupt storage remain usable with an operator warning", () => {
  for (const storage of [undefined, { getItem() { throw Error(); } },
    { getItem: () => '{"version":1,"counts":{"sessions":-1}}', setItem() {} },
    { getItem: () => "not json", setItem() {} },
    { getItem: () => null, setItem() { throw Error(); } }]) {
    const counters = createCounters(storage);
    counters.start();
    counters.record("exports");
    counters.record("exports");
    assert.equal(counters.snapshot().exports, 1);
    assert.match(counters.warning, /memory/);
    assert.match(counters.csv(), /exports,1/);
  }
});

test("old stored pledge fields are discarded while existing totals survive", () => {
  const storage = memory();
  storage.setItem(COUNTERS_KEY, JSON.stringify({ version: 1,
    counts: { sessions: 3, draw: 2, quiz: 1, pledges: 2, exports: 1 },
    active: { draw: true, quiz: false, pledges: true, exports: false } }));
  const counters = createCounters(storage);
  counters.record("pledges");
  counters.record("exports");
  assert.deepEqual(counters.snapshot(), { sessions: 3, draw: 2, quiz: 1, exports: 2 });
  assert.ok(!counters.csv().includes("pledge"));
  assert.ok(!storage.getItem(COUNTERS_KEY).includes("pledge"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { createFactRotator, renderPhotoFact, shuffled } from "../js/fact-rotator.js";
import { FACTS } from "../js/awareness-facts.js";

test("next while locked cannot change a fact, including a timer between lock and capture", () => {
  const r = createFactRotator(["First fact", "Second fact"], "source", { random: () => 0, storage: null });
  r.next();
  const displayed = r.lock();
  const timer = () => r.next();
  timer();
  const captured = r.current();
  assert.deepEqual(r.state, { current: displayed, locked: true });
  assert.equal(captured, displayed);
  r.unlock();
  assert.notEqual(r.next().text, displayed.text);
});
test("renderer paints the exact state text/source fully opaque despite fade", () => {
  const calls = [];
  const ctx = {
    globalAlpha: .2, save() {}, restore() {}, fillRect() {},
    fillText(text) { calls.push([text, this.globalAlpha]); },
  };
  const fact = createFactRotator(undefined, undefined, { storage: null }).lock();
  renderPhotoFact(ctx, fact, 1080, 1920);
  assert.deepEqual(calls, [[fact.text, 1], ["Source: WHO", 1], [fact.source, 1]]);
});

function seeded(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function memStore() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; }

test("rounds start at a random fact and use only the existing facts", () => {
  const starts = new Set();
  for (let seed = 1; seed <= 40; seed += 1) starts.add(createFactRotator(FACTS, "s", { random: seeded(seed), storage: null }).current().text);
  assert.ok(starts.size >= 4, `expected varied starts, got ${starts.size}`);
  for (const text of starts) assert.ok(FACTS.includes(text));
  assert.equal(FACTS.length, 8);
});

test("a shuffled cycle shows every fact once, with no immediate repeats across cycles", () => {
  const r = createFactRotator(FACTS, "s", { random: seeded(7), storage: null });
  const seen = [r.current().text];
  for (let i = 1; i < FACTS.length * 5; i += 1) seen.push(r.next().text);
  assert.deepEqual(new Set(seen.slice(0, FACTS.length)).size, FACTS.length);
  for (let i = 1; i < seen.length; i += 1) assert.notEqual(seen[i], seen[i - 1]);
});

test("a new round avoids the previous round's starting fact (persisted)", () => {
  const storage = memStore();
  for (let seed = 1; seed <= 30; seed += 1) {
    const prev = storage.getItem("pob-last-fact-start");
    const r = createFactRotator(FACTS, "s", { random: () => 0, storage });
    if (prev) assert.notEqual(r.current().text, prev);
  }
  const r = createFactRotator(FACTS, "s", { random: seeded(3), storage });
  for (let i = 0; i < 20; i += 1) { const before = r.current().text; assert.notEqual(r.reset().text, before); }
});

test("reset is ignored while locked so capture stays frozen", () => {
  const r = createFactRotator(FACTS, "s", { random: seeded(9), storage: null });
  const shown = r.lock();
  assert.equal(r.reset(), shown); assert.equal(r.next(), shown);
});

test("shuffled is a permutation", () => {
  assert.deepEqual(shuffled(FACTS, seeded(5)).slice().sort(), FACTS.slice().sort());
});

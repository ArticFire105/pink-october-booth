import test from "node:test";
import assert from "node:assert/strict";
import { setupStats } from "../js/stats.js";

test("organizer reset requires confirmation and cancelled reset preserves counters", () => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, { showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  let approved = false, resets = 0;
  globalThis.document = { getElementById: get, addEventListener() {} };
  globalThis.window = { localStorage: { getItem: () => null, setItem() {} }, confirm: () => approved };
  try {
    const counters = setupStats(() => resets++);
    counters.start();
    counters.record("quiz");
    get("stats-open").onclick();
    assert.equal(get("stats").open, true);
    assert.equal(get("count-quiz").textContent, 1);
    get("stats-reset").onclick();
    assert.equal(resets, 0);
    assert.equal(counters.snapshot().sessions, 1);
    approved = true;
    get("stats-reset").onclick();
    assert.equal(resets, 1);
    assert.equal(counters.snapshot().sessions, 0);
    assert.equal(get("count-quiz").textContent, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
});

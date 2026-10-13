import test from "node:test";
import assert from "node:assert/strict";
import { createFactRotator, renderPhotoFact } from "../js/fact-rotator.js";

test("next while locked cannot change a fact, including a timer between lock and capture", () => {
  const r = createFactRotator(["First fact", "Second fact"], "source");
  r.next();
  const displayed = r.lock();
  const timer = () => r.next();
  timer();
  const captured = r.current();
  assert.deepEqual(r.state, { current: displayed, locked: true });
  assert.equal(captured, displayed);
  r.unlock();
  assert.equal(r.next().text, "First fact");
});
test("renderer paints the exact state text/source fully opaque despite fade", () => {
  const calls = [];
  const ctx = {
    globalAlpha: .2, save() {}, restore() {}, fillRect() {},
    fillText(text) { calls.push([text, this.globalAlpha]); },
  };
  const fact = createFactRotator().lock();
  renderPhotoFact(ctx, fact, 1080, 1920);
  assert.deepEqual(calls, [[fact.text, 1], ["Source: WHO", 1], [fact.source, 1]]);
});

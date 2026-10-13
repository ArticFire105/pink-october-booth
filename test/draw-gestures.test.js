import test from "node:test";
import assert from "node:assert/strict";
import { createPinchLatch, shouldClearCanvas, createEdgeHold, PALM_CLEAR_MS } from "../js/gestures.js";

test("v2 pinch hysteresis closes below .38 and releases at .55", () => {
  const latch = createPinchLatch();
  for (const [ratio, closed] of [[.38, false], [.379, true], [.45, true], [.549, true], [.55, false], [.45, false], [.3, true], [null, false]]) {
    assert.equal(latch.update(ratio), closed);
  }
});
test("v2 palm clear holds for 280ms and a pinch blocks clearing", () => {
  const gate = createEdgeHold(PALM_CLEAR_MS);
  assert.equal(PALM_CLEAR_MS, 280);
  assert.equal(shouldClearCanvas(true, true), false);
  assert.equal(gate.update(shouldClearCanvas(true, false), 0), false);
  assert.equal(gate.update(true, 279), false);
  assert.equal(gate.update(true, 280), true);
  assert.equal(gate.update(true, 560), false);
});

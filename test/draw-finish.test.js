import test from "node:test";
import assert from "node:assert/strict";
import { createDrawFinish, drawingProgress } from "../js/draw-finish.js";
import { heartOutline, placeOutline } from "../js/heart-score.js";
const target = placeOutline(heartOutline(100), 300, 250, 250);
const partial = target.slice(0, 80);
const input = (now, strokes, extra = {}) => ({ now, strokes, target, pinching: true, ...extra });

test("most of the heart closing near its start auto-finishes, including lifted gaps", () => {
  for (const strokes of [[target], [target.slice(0, 45), target.slice(48)]]) {
    assert.equal(createDrawFinish().update(input(0, strokes)).reason, "closed");
  }
});
test("85% coverage alone does not finish", () => {
  assert.equal(createDrawFinish().update(input(0, [target.slice(0, 86)])).reason, null);
});
test("most of a heart plus 1.5 seconds without v2 pinch finishes, including hand loss", () => {
  const machine = createDrawFinish();
  const sample = now => input(now, [partial], { pinching: false, handVisible: false });
  assert.equal(machine.update(sample(0)).reason, null);
  assert.equal(machine.update(sample(1499)).reason, null);
  assert.equal(machine.update(sample(1500)).reason, "released");
});
test("resuming pinch or resetting interrupts release completion", () => {
  const machine = createDrawFinish();
  machine.update(input(0, [partial], { pinching: false }));
  machine.update(input(1000, [partial]));
  assert.equal(machine.update(input(1600, [partial], { pinching: false })).reason, null);
  machine.reset();
  assert.equal(machine.update(input(3100, [partial], { pinching: false })).reason, null);
  assert.equal(machine.update(input(4600, [partial], { pinching: false })).reason, "released");
});
test("no timer ends an empty or unfinished drawing", () => {
  for (const strokes of [[], [target.slice(0, 50)]]) {
    const machine = createDrawFinish();
    machine.update(input(0, strokes, { pinching: false }));
    assert.equal(machine.update(input(100000, strokes, { pinching: false })).reason, null);
  }
});
test("a dot, tiny loop or disconnected dots have not drawn most of the heart", () => {
  for (const strokes of [[Array(100).fill(target[0])],
    [target.map(p => ({ x: p.x / 10, y: p.y / 10 }))],
    target.filter((_, i) => i % 10 === 0).map(p => [p])]) {
    assert.equal(drawingProgress(strokes, target).enough, false);
    assert.equal(createDrawFinish().update(input(0, strokes)).reason, null);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { drawProgress, DRAW_MS } from "../js/ribbon-pencil.js";

test("ribbon pencil progress runs 0 to 1 over ~2.3 s and clamps", () => {
  assert.equal(drawProgress(-50), 0);
  assert.equal(drawProgress(0), 0);
  assert.equal(drawProgress(DRAW_MS / 2), 0.5);
  assert.equal(drawProgress(DRAW_MS), 1);
  assert.equal(drawProgress(DRAW_MS * 3), 1);
  assert.ok(DRAW_MS >= 2000 && DRAW_MS <= 2500);
});

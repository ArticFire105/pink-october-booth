import test from "node:test";
import assert from "node:assert/strict";
import { isThumbsUp } from "../js/gestures.js";

function hand(thumbUp, curled) {
  const p = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  p[0] = { x: 0.5, y: 0.7 };            // wrist
  p[9] = { x: 0.5, y: 0.6 };            // middle MCP (scale 0.1)
  p[2] = { x: 0.45, y: 0.62 }; p[3] = { x: 0.44, y: thumbUp ? 0.56 : 0.63 }; p[4] = { x: 0.44, y: thumbUp ? 0.5 : 0.64 };
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    p[pip] = { x: 0.52, y: 0.55 };
    p[tip] = curled ? { x: 0.52, y: 0.64 } : { x: 0.52, y: 0.45 };
  }
  return p;
}

test("thumbs-up: thumb above IP/MCP with curled fingers", () => {
  assert.equal(isThumbsUp(hand(true, true)), true);
});
test("thumbs-up rejects open hand, down thumb, and missing hands", () => {
  assert.equal(isThumbsUp(hand(true, false)), false);
  assert.equal(isThumbsUp(hand(false, true)), false);
  assert.equal(isThumbsUp(null), false);
});

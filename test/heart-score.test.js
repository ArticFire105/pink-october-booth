import test from "node:test";
import assert from "node:assert/strict";
import { heartOutline, scoreHeartDrawing, starsForPercent } from "../js/heart-score.js";
const heart = heartOutline(100);
// Golden results from the read-only v2 scorer, including its gap and dot behavior.
test("v2 scoring golden results", () => {
  for (const [input, percent, stars] of [
    [[], 0, 0], [heart, 97, 5], [heart.slice(0, 50), 47, 2],
    [[heart.slice(0, 40), heart.slice(60)], 92, 5],
    [Array(100).fill(heart[0]), 43, 2],
    [heart.map(p => ({ x: p.x * 0.01 + 10, y: p.y * 0.01 + 20 })), 97, 5],
  ]) {
    const result = scoreHeartDrawing(input);
    assert.equal(result.percent, percent);
    assert.equal(result.stars, stars);
  }
});
test("v2 star thresholds", () => {
  for (const [percent, stars] of [[17, 0], [18, 1], [40, 2], [58, 3], [74, 4], [88, 5]]) {
    assert.equal(starsForPercent(percent), stars);
    assert.equal(starsForPercent(percent - 1), Math.max(0, stars - 1));
  }
});

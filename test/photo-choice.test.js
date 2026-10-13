import test from "node:test";
import assert from "node:assert/strict";
import { createPhotoChoice } from "../js/photo-choice.js";

test("entry grace excludes drawing gesture; then a full 500ms hold chooses", () => {
  const choice = createPhotoChoice(100);
  assert.equal(choice.update("photo", 100).progress, 0);
  assert.equal(choice.update("photo", 799).progress, 0);
  assert.equal(choice.update("photo", 800).progress, 0);
  assert.equal(choice.update("photo", 1299).selected, null);
  assert.equal(choice.update("photo", 1300).selected, "photo");
});
test("release and changing gestures reset hold", () => {
  const c = createPhotoChoice(0);
  c.update("photo", 700);
  assert.equal(c.update("photo", 950).progress, .5);
  assert.equal(c.update(null, 1000).progress, 0);
  c.update("photo", 1100);
  assert.equal(c.update("heart", 1500).progress, 0);
  assert.equal(c.update("heart", 2000).selected, "heart");
});
test("12s timeout defaults to heart and selection is final", () => {
  const c = createPhotoChoice(100);
  assert.equal(c.update(null, 12099).selected, null);
  assert.equal(c.update("photo", 12100).selected, "heart");
  assert.equal(c.choose("photo"), "heart");
});
test("both backup buttons can choose immediately during grace", () => {
  for (const option of ["photo", "heart"]) {
    const c = createPhotoChoice(100);
    assert.equal(c.choose(option), option);
    assert.equal(c.update(null, 20000).selected, option);
  }
});

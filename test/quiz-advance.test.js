import test from "node:test";
import assert from "node:assert/strict";
import { createQuizAdvance } from "../js/quiz-advance.js";

test("thumbs up never answers or accumulates an advance hold while answering", () => {
  const q = createQuizAdvance();
  for (const now of [0, 500, 1000]) {
    const r = q.update({ thumbsUp: true, tiltChoice: "myth", now });
    assert.equal(r.advance, false);
    assert.equal(r.tiltChoice, null);
  }
  q.reveal();
  assert.equal(q.update({ thumbsUp: true, now: 1100 }).advance, false);
  assert.equal(q.update({ thumbsUp: true, now: 1599 }).advance, false);
  assert.equal(q.update({ thumbsUp: true, now: 1600 }).advance, true);
  assert.equal(q.update({ thumbsUp: true, now: 2100 }).advance, false);
});

test("release cancels reveal hold; every advance requires near-centre re-arm", () => {
  const q = createQuizAdvance();
  q.reveal();
  q.update({ thumbsUp: true, now: 0 });
  q.update({ thumbsUp: false, now: 400 });
  assert.equal(q.update({ thumbsUp: true, now: 500 }).advance, false);
  assert.equal(q.update({ thumbsUp: true, now: 1000 }).advance, true);
  assert.equal(q.next(), true);
  for (const angle of [.3, -.3, null, NaN]) {
    assert.equal(q.update({ angle, tiltChoice: "fact", now: 1100 }).tiltChoice, null);
  }
  assert.equal(q.update({ angle: 0, calibrating: true, now: 1200 }).armed, false);
  assert.equal(q.update({ angle: .02, now: 1300 }).armed, true);
  assert.equal(q.update({ angle: .3, tiltChoice: "myth", now: 2100 }).tiltChoice, "myth");
  q.reveal();
  assert.equal(q.next(), true); // Button uses the same transition.
  assert.equal(q.update({ angle: .3, tiltChoice: "myth", now: 2200 }).tiltChoice, null);
  q.reveal();
  assert.equal(q.next(), true);
  assert.equal(q.update({ thumbsUp: true, now: 3000 }).phase, "done");
  assert.equal(q.next(), false);
});

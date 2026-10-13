import test from "node:test";
import assert from "node:assert/strict";
import { portraitCrop, faceCentre } from "../js/portrait-crop.js";

test("portrait crop centres on a face and clamps to every frame edge", () => {
  for (const [width, height] of [[1920, 1080], [600, 1600], [1080, 1920]]) {
    for (const centre of [null, { x: .7, y: .6 }, { x: 0, y: 0 }, { x: 1, y: 1 },
      { x: -2, y: 3 }, { x: NaN, y: .2 }]) {
      const r = portraitCrop(width, height, centre);
      assert.ok(Math.abs(r.width / r.height - 9 / 16) < 1e-10);
      assert.ok(r.x >= 0 && r.y >= 0);
      assert.ok(r.x + r.width <= width && r.y + r.height <= height);
    }
  }
  const r = portraitCrop(1920, 1080, { x: .7, y: .5 });
  assert.equal(r.x + r.width / 2, 1920 * .7);
  assert.deepEqual(portraitCrop(1920, 1080), portraitCrop(1920, 1080, { x: .5, y: .5 }));
  assert.throws(() => portraitCrop(0, 1080), RangeError);
});

test("face centre uses landmark bounds and falls back when missing", () => {
  assert.equal(faceCentre(null), null);
  assert.equal(faceCentre([]), null);
  assert.deepEqual(faceCentre([{ x: .2, y: .3 }, { x: .8, y: .7 }]), { x: .5, y: .5 });
});

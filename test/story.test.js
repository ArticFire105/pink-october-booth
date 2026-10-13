import test from "node:test";
import assert from "node:assert/strict";
import { FACT, renderStory, pngBlob, shareStory } from "../js/story.js";

function canvasSpy() {
  const text = [], images = [];
  const ctx = {
    fillRect() {},
    fillText(value, x, y) { text.push({ value, x, y }); },
    measureText(value) { return { width: value.length * 24 }; },
    drawImage(...args) { images.push(args); },
  };
  return { canvas: { getContext: () => ctx }, text, images };
}

test("all artwork types use one portrait layout with fact, source and branding", () => {
  for (const artwork of [null, { width: 1920, height: 1080 }, { width: 720, height: 1280 }]) {
    const { canvas, text, images } = canvasSpy();
    renderStory(canvas, { artwork, correct: 2, total: 3, label: "Round complete" });
    assert.equal(canvas.width, 1080);
    assert.equal(canvas.height, 1920);
    const words = text.map(t => t.value).join(" ");
    assert.ok(words.includes(FACT));
    assert.ok(words.includes("Breast cancer awareness"));
    assert.ok(words.includes("Source: WHO"));
    assert.ok(words.includes("#GDGPinkOctober"));
    assert.ok(!words.includes("pledge"));
    assert.ok(text.every(t => t.y < 1920));
    if (artwork) {
      const [image, x, y, width, height] = images[0];
      assert.equal(image, artwork);
      assert.ok(x >= 80 && y >= 470 && x + width <= 1000 && y + height <= 1120);
      assert.equal(width / height, artwork.width / artwork.height);
    } else assert.ok(!words.includes("2 of 3"));
  }
});

test("story uses the selected fact and never prints score, stars or a score-bearing label", () => {
  const { canvas, text } = canvasSpy();
  renderStory(canvas, { correct: 3, total: 4, percent: 88, stars: 4,
    label: "Draw Hope · 88% · 4/5 stars", fact: "Breast cancer can also affect men." });
  const words = text.map(t => t.value).join(" ");
  assert.ok(words.includes("Breast cancer can also affect men."));
  assert.doesNotMatch(words, /88|4\/5|3 of 4|★|☆|pledge/i);
});

test("PNG encoding handles both success and a null blob", async () => {
  const blob = new Blob(["png"], { type: "image/png" });
  assert.equal(await pngBlob({ toBlob(cb, type) { assert.equal(type, "image/png"); cb(blob); } }), blob);
  await assert.rejects(pngBlob({ toBlob(cb) { cb(null); } }), /PNG generation failed/);
});

test("supported sharing passes the prepared file without downloading", async () => {
  const file = { type: "image/png" };
  let shared = false;
  assert.equal(await shareStory(file, {
    canShare({ files }) { assert.deepEqual(files, [file]); return true; },
    async share({ files }) { assert.deepEqual(files, [file]); shared = true; },
  }, () => assert.fail("Unexpected download")), "shared");
  assert.equal(shared, true);
});

test("unsupported or failed sharing downloads; cancellation does not", async () => {
  for (const nav of [{}, { canShare: () => false }, {
    canShare: () => true, share: async () => { throw new Error("Blocked"); },
  }, { canShare: () => { throw new Error("Unsupported"); } }]) {
    let downloads = 0;
    assert.equal(await shareStory({}, nav, () => downloads++), "downloaded");
    assert.equal(downloads, 1);
  }
  assert.equal(await shareStory({}, {
    canShare: () => true,
    share: async () => { throw Object.assign(new Error("Cancel"), { name: "AbortError" }); },
  }, () => assert.fail("Cancellation must not download")), "cancelled");
});

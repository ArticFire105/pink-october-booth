import { mockContext } from "./helpers/canvas.js";
import test from "node:test";
import assert from "node:assert/strict";
import { FACT, ensureStoryFonts, renderStory, pngBlob, shareStory } from "../js/story.js";

function canvasSpy() {
  const text = [], images = [];
  const ctx = mockContext({
    fillRect() {},
    fillText(value, x, y) { text.push({ value, x, y }); },
    drawImage(...args) { images.push(args); },
  });
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
    assert.ok(words.includes("PINK OCTOBER"));
    assert.ok(!words.includes("Scan:"));
    assert.ok(words.includes("Source: WHO"));
    assert.ok(words.includes("#GDGPinkOctober"));
    assert.ok(!words.includes("pledge"));
    assert.ok(text.every(t => t.y < 1920));
    if (artwork) {
      const [image, x, y, width, height] = images[0];
      assert.equal(image, artwork);
      assert.ok(x >= -335 && y >= -370 && x + width <= 335 && y + height <= 270);
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


test("heart and photo variants render the fact and preserve their fit rules", () => {
  for (const variant of ["heart", "photo"]) {
    const { canvas, text, images } = canvasSpy();
    const artwork = { width: 1080, height: 1920 };
    assert.doesNotThrow(() => renderStory(canvas, { artwork, variant, fact: "A sample awareness fact." }));
    assert.ok(text.map(t => t.value).join(" ").includes("A sample awareness fact."));
    assert.equal(images[0].length, variant === "photo" ? 9 : 5);
    if (variant === "photo") {
      const [, sx, sy, sw, sh, , , w, h] = images[0];
      assert.ok(sx >= 0 && sy >= 0 && sx + sw <= artwork.width && sy + sh <= artwork.height);
      assert.ok(Math.abs(sw / sh - w / h) < 1e-10);
    }
  }
});

test("font preparation is guarded and awaits both typefaces", async () => {
  const previous = globalThis.document;
  try {
    delete globalThis.document;
    await ensureStoryFonts();
    const loaded = [], pending = [];
    globalThis.document = { fonts: { load(font) { loaded.push(font); return new Promise(resolve => pending.push(resolve)); } } };
    let done = false;
    const ready = ensureStoryFonts().then(() => { done = true; });
    await Promise.resolve();
    assert.equal(done, false);
    assert.deepEqual(loaded, ['600 64px "Bodoni Moda"', '600 40px "DM Sans"']);
    pending.forEach(resolve => resolve()); await ready;
    assert.equal(done, true);
  } finally { globalThis.document = previous; }
});


test("watercolour is repeatable and long facts shrink within the card", () => {
  const traces = [];
  for (let run = 0; run < 2; run++) {
    const wash = [], factLines = [];
    const ctx = mockContext({
      createRadialGradient(...args) { wash.push(args); return { addColorStop() {} }; },
      fillText(value, x, y) { if (value.includes("awareness")) factLines.push({ y, font: this.font }); },
    });
    renderStory({ getContext: () => ctx }, { fact: "awareness ".repeat(100) });
    traces.push(wash);
    assert.ok(factLines.length > 1);
    assert.ok(factLines.every(line => line.y > 1320 && line.y < 1600));
    assert.ok(factLines.every(line => Number(line.font.match(/(\d+)px/)[1]) < 44));
  }
  assert.deepEqual(traces[0], traces[1]);
});

test("story writes the sanitised player name on the polaroid only when present", async () => {
  const { renderStory } = await import("../js/story.js");
  const texts = [];
  const ctx = new Proxy({ fillText: t => texts.push(t), measureText: () => ({ width: 100 }),
    createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: [] }) }, { get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) });
  const canvas = { getContext: () => ctx };
  renderStory(canvas, { name: "Ri<s>hi 9", fact: "F" });
  assert.ok(texts.includes("Rishi\u2019s heart"), texts.join("|"));
  texts.length = 0;
  renderStory(canvas, { fact: "F" });
  assert.ok(!texts.some(t => /\u2019s heart$/.test(t)));
});

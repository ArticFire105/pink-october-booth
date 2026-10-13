import test from "node:test";
import assert from "node:assert/strict";
import { createResultScreen } from "../js/result.js";

test("automatic result produces separate heart/photo downloads and clears stale exports", async () => {
  const elements = new Map();
  const pending = [];
  const revoked = [];
  const downloads = [];
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, disabled: false, textContent: "",
      getContext() { return { drawImage() {}, fillRect() {} }; },
      removeAttribute(name) { delete this[name]; }, focus() {},
    });
    return elements.get(id);
  };
  const previousDocument = globalThis.document;
  const previousFile = globalThis.File;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  let sequence = 0, exports = 0, homes = 0;
  let timer;
  globalThis.document = {
    getElementById: get,
    body: { append() {} },
    createElement(tag) {
      if (tag === "a") return { click() { downloads.push(this); }, remove() {} };
      return { getContext: () => ({ fillRect() {}, fillText() {}, drawImage() {}, measureText: s => ({ width: s.length * 20 }) }),
        toBlob(cb) { pending.push(cb); } };
    },
  };
  globalThis.File = class { constructor(parts, name, options) { this.name = name; this.type = options.type; } };
  URL.createObjectURL = () => `blob:${++sequence}`;
  URL.revokeObjectURL = url => revoked.push(url);
  const flush = async () => { pending.shift()(new Blob(["png"])); await Promise.resolve(); await Promise.resolve(); };
  try {
    const screen = createResultScreen({ onHome: () => homes++,
      onExport: () => exports++,
      schedule(fn, ms) { assert.equal(ms, 45000); timer = fn; return 1; },
      cancel() { timer = null; } });
    const heart = { width: 800, height: 600 };
    screen.show({ percent: 82, stars: 4, artwork: heart, heartArtwork: heart, fact: "Chosen awareness fact." });
    assert.equal(pending.length, 1, "PNG generation starts without a click");
    assert.equal(get("story-step").hidden, false);
    assert.equal(get("story-share").disabled, true);
    await flush();
    assert.equal(get("story-preview").src, "blob:1");
    assert.equal(get("photo-download").hidden, true);
    assert.equal(get("result-fact").textContent, "Chosen awareness fact.");
    get("story-download").onclick();
    assert.equal(exports, 1);

    const photo = { width: 1080, height: 1920, toBlob(cb) { pending.push(cb); } };
    screen.show({ artwork: photo, heartArtwork: heart, photoArtwork: photo });
    await flush();
    assert.equal(pending.length, 1, "photo is encoded separately from heart");
    await flush();
    assert.equal(get("story-preview").src, "blob:3");
    assert.equal(get("photo-download").hidden, false);
    get("story-download").onclick();
    get("photo-download").onclick();
    assert.equal(exports, 3);
    assert.deepEqual(downloads.map(a => [a.href, a.download]), [
      ["blob:1", "pink-october-heart.png"],
      ["blob:2", "pink-october-heart.png"],
      ["blob:3", "pink-october-photo.png"],
    ]);
    screen.clear();
    assert.deepEqual(revoked, ["blob:1", "blob:2", "blob:3"]);
    assert.equal(get("story-preview").src, undefined);
    screen.show({ artwork: heart });
    screen.clear();
    await flush();
    assert.equal(get("story-preview").src, undefined, "late PNG cannot revive cleared result");
    assert.equal(get("story-share").disabled, true);
    screen.show({ artwork: heart });
    await flush();
    get("result-more-time").onclick();
    timer();
    assert.equal(homes, 1);
    screen.clear();
  } finally {
    globalThis.document = previousDocument;
    globalThis.File = previousFile;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
});

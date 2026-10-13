import test from "node:test";
import assert from "node:assert/strict";
import { createResultScreen } from "../js/result.js";

test("shared finish preserves the selected fact through photos and clears stale exports", async () => {
  const elements = new Map();
  const pending = [];
  const revoked = [];
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, disabled: false, textContent: "",
      getContext() { return { drawImage() {} }; },
      removeAttribute(name) { delete this[name]; }, focus() {},
    });
    return elements.get(id);
  };
  const previousDocument = globalThis.document;
  const previousFile = globalThis.File;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  let sequence = 0, photos = 0, exports = 0, homes = 0;
  let timer;
  globalThis.document = {
    getElementById: get,
    body: { append() {} },
    createElement(tag) {
      if (tag === "a") return { click() {}, remove() {} };
      return { getContext: () => ({ fillRect() {}, fillText() {}, drawImage() {}, measureText: s => ({ width: s.length * 20 }) }),
        toBlob(cb) { pending.push(cb); } };
    },
  };
  globalThis.File = class { constructor(parts, name, options) { this.name = name; this.type = options.type; } };
  URL.createObjectURL = () => `blob:${++sequence}`;
  URL.revokeObjectURL = url => revoked.push(url);
  const flush = async () => { pending.shift()(new Blob(["png"])); await Promise.resolve(); await Promise.resolve(); };
  try {
    const screen = createResultScreen({ onPhoto: () => photos++, onHome: () => homes++,
      onExport: () => exports++,
      schedule(fn, ms) { assert.equal(ms, 45000); timer = fn; return 1; },
      cancel() { timer = null; } });
    screen.show({ label: "Quiz", correct: 2, total: 4, fact: "Chosen awareness fact." });
    assert.equal(get("result").hidden, false);
    assert.equal(get("story-share").disabled, true);
    assert.equal(pending.length, 0);
    assert.equal(get("story-step").hidden, true);
    get("story-make").onclick();
    await flush();
    assert.equal(get("result-fact").textContent, "Chosen awareness fact.");
    assert.equal(get("story-step").hidden, false);
    assert.equal(get("story-status").textContent, "Your story is ready.");
    assert.equal(get("story-preview").src, "blob:1");
    get("result-photo").onclick();
    assert.equal(photos, 1);
    assert.equal(timer, null);
    assert.equal(exports, 0);
    assert.deepEqual(revoked, ["blob:1"]);
    screen.show({ label: "Photo", fact: "Chosen awareness fact.", artwork: { width: 1280, height: 720 } }, true);
    await flush();
    assert.equal(get("story-status").textContent, "Your story is ready.");
    assert.equal(get("result-fact").textContent, "Chosen awareness fact.");

    get("story-download").onclick();
    assert.equal(exports, 1);
    get("story-make").onclick();
    screen.clear();
    assert.equal(timer, null);
    await flush();
    assert.equal(get("story-preview").src, undefined);
    assert.equal(get("result").hidden, true);
    assert.equal(get("story-share").disabled, true);
    screen.show({ label: "Draw", percent: 82, stars: 4, artwork: { width: 800, height: 600 } });
    assert.equal(get("result-summary").textContent, "82%");
    assert.equal(get("result-stars").textContent, "★★★★☆");
    assert.equal(get("result-artwork").hidden, false);
    assert.equal(get("result-achievement").hidden, false);
    assert.equal(pending.length, 0);
    assert.equal(get("story-preview").hidden, true);
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

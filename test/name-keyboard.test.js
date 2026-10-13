import test from "node:test";
import assert from "node:assert/strict";
import { keyboardLayout, hitKey, createNameEntry, sanitizeName, finalName, NAME_MAX } from "../js/name-keyboard.js";

const keys = keyboardLayout();
const centre = id => { const k = keys.find(k => k.id === id); return { x: k.x + k.w / 2, y: k.y + k.h / 2 }; };

test("layout has A–Z plus Space, Backspace, Skip and Done, without overlaps", () => {
  const ids = keys.map(k => k.id);
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") assert.ok(ids.includes(ch), ch);
  for (const id of ["SPACE", "BACK", "SKIP", "OK"]) assert.ok(ids.includes(id));
  for (const k of keys) assert.equal(hitKey(keys, centre(k.id)).id, k.id);
});

test("hit-testing misses outside keys", () => {
  assert.equal(hitKey(keys, { x: .01, y: .01 }), null);
  assert.equal(hitKey(keys, null), null);
});

test("one pinch types one letter; holding the pinch does not repeat", () => {
  const e = createNameEntry();
  let t = 0;
  e.update({ key: "A", pinching: false, now: t += 100 });
  e.update({ key: "A", pinching: true, now: t += 100 });
  for (let i = 0; i < 10; i++) e.update({ key: "A", pinching: true, now: t += 100 });
  assert.equal(e.name, "A");
  e.update({ key: "B", pinching: false, now: t += 100 });
  e.update({ key: "B", pinching: true, now: t += 100 });
  assert.equal(e.name, "Ab");
});

test("a pinch held when the step opens is ignored; jittery re-pinch within the gap is ignored", () => {
  const e = createNameEntry();
  e.update({ key: "A", pinching: true, now: 0 });
  assert.equal(e.name, "");
  e.update({ key: "A", pinching: false, now: 100 });
  e.update({ key: "A", pinching: true, now: 400 });
  e.update({ key: "A", pinching: false, now: 450 });
  e.update({ key: "A", pinching: true, now: 500 });
  assert.equal(e.name, "A");
});

test("max length, space and backspace", () => {
  const e = createNameEntry();
  for (let i = 0; i < 20; i++) e.press("Z", i * 1000);
  assert.equal(e.name.length, NAME_MAX);
  const f = createNameEntry();
  f.press("SPACE"); assert.equal(f.name, "");
  f.press("A"); f.press("SPACE"); f.press("SPACE"); f.press("B");
  assert.equal(f.name, "A b");
  f.press("BACK"); f.press("BACK"); assert.equal(f.name, "A");
});

test("sanitize keeps letters and single spaces only", () => {
  assert.equal(sanitizeName("  Ri$hi  <b>2</b>  V"), "Rihi bb V");
  assert.equal(finalName("Ann "), "Ann");
  assert.equal(sanitizeName("abcdefghijklmnopq").length, NAME_MAX);
});

test("thumbs-up confirms after 500 ms only with at least one letter", () => {
  const e = createNameEntry();
  e.update({ thumbsUp: true, now: 0 }); e.update({ thumbsUp: true, now: 900 });
  assert.equal(e.result, null);
  e.press("R");
  e.update({ thumbsUp: true, now: 1000 });
  assert.equal(e.update({ thumbsUp: true, now: 1400 }).result, null);
  e.update({ thumbsUp: false, now: 1450 });
  e.update({ thumbsUp: true, now: 1500 });
  assert.deepEqual(e.update({ thumbsUp: true, now: 2000 }).result, { done: true, name: "R" });
});

test("skip finishes with no name; Done needs a letter", () => {
  const e = createNameEntry();
  assert.equal(e.press("OK"), null);
  assert.deepEqual(e.press("SKIP"), { done: true, name: "" });
  const f = createNameEntry(); f.press("J"); f.press("O");
  assert.deepEqual(f.press("OK"), { done: true, name: "Jo" });
});

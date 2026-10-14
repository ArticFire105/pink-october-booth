import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Draw Hope has no time limit or visible countdown; idle recovery remains", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(app, /DRAW_LIMIT_MS/);
  assert.doesNotMatch(app, /drawTimer\.hidden = false/);
  assert.match(html, /id="draw-timer"[^>]*hidden><\/p>/);
  assert.match(app, /result\.reason \|\|/, "auto-finish on loop close / no-pinch stays");
  assert.match(app, /idle\.expired\(now\)\) nextVisitor\(\)/, "idle booth still resets");
});

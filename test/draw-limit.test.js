import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Draw Hope time limit is 45 seconds and the initial timer label matches", () => {
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(app, /const DRAW_LIMIT_MS = 45000;/);
  assert.match(html, /id="draw-timer"[^>]*>45s</);
});

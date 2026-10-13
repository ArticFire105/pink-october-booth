import test from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, paintQR } from '../js/story-qr.js';
import { SOURCE, renderStory } from '../js/story.js';

test('local QR encoder generates a square WHO matrix with finder patterns', () => {
  const matrix = qrMatrix(SOURCE);
  assert.ok(matrix.length >= 21);
  assert.ok(matrix.every(row => row.length === matrix.length));
  for (const [r, c] of [[0, 0], [0, matrix.length - 7], [matrix.length - 7, 0]]) {
    for (let i = 0; i < 7; i++) assert.equal(matrix[r][c + i], true);
    assert.equal(matrix[r + 1][c + 1], false);
    assert.equal(matrix[r + 3][c + 3], true);
  }
  assert.notDeepEqual(matrix, qrMatrix('https://example.com'));
});
test('story QR uses integer modules and four-module quiet zone within the portrait', () => {
  const rects = [];
  const ctx = { fillRect: (...args) => rects.push(args) };
  const size = paintQR(ctx, SOURCE, 724, 1490, 5);
  assert.ok(724 + size <= 1000 && 1490 + size < 1740);
  for (const [x, y, w, h] of rects.slice(1)) {
    assert.ok(x >= 744 && y >= 1510);
    assert.ok(x + w <= 724 + size - 20 && y + h <= 1490 + size - 20);
    assert.equal(w, 5); assert.equal(h, 5);
  }
  const labels = [];
  renderStory({ getContext: () => ({ ...ctx, fillText: text => labels.push(text), measureText: text => ({ width: text.length * 20 }) }) }, { label: 'Draw Hope' }, true);
  assert.ok(labels.includes('Scan: WHO fact sheet'));
});

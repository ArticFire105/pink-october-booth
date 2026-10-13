import qrcode from '../vendor/qrcode.js';

export function qrMatrix(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return Array.from({ length: qr.getModuleCount() }, (_, row) =>
    Array.from({ length: qr.getModuleCount() }, (_, col) => qr.isDark(row, col)));
}

export function paintQR(ctx, text, x, y, cell = 6) {
  const matrix = qrMatrix(text);
  const size = (matrix.length + 8) * cell;
  ctx.fillStyle = '#FFF8FB';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#39152A';
  matrix.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect(x + (c + 4) * cell, y + (r + 4) * cell, cell, cell);
  }));
  return size;
}

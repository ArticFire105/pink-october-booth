// All boxes use { x, y, width, height } in portrait pixels. Sticker x/y is
// its centre; size bounds the entire rotated artwork (including its outline).
export function boundsOf(points, padding = 0) {
  const valid = (points ?? []).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (!valid.length) return null;
  const xs = valid.map(p => p.x), ys = valid.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const width = Math.max(...xs) - x, height = Math.max(...ys) - y;
  return { x: x - width * padding, y: y - height * padding,
    width: width * (1 + 2 * padding), height: height * (1 + 2 * padding) };
}

export function stickerBounds({ x, y, size }) {
  return { x: x - size / 2, y: y - size / 2, width: size, height: size };
}
const overlaps = (a, b) => b && a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

export function layoutStickers(width, height, faceBox, heartBox) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) return [];
  const unit = Math.min(width, height), margin = unit * .018;
  const items = [];
  const specs = [
    ['ribbon', .19, -.12, 0], ['tag', .34, -.08, 3],
    ['stamp', .29, .06, 2], ['tape', .25, -.13, 1],
    ['heart', .065, -.18, 4], ['sparkle', .06, .1, 5],
    ['heart', .055, .16, 6], ['sparkle', .065, -.1, 7],
  ];
  for (const [type, scale, rotation, preferred] of specs) {
    const size = unit * scale, edge = size / 2 + margin;
    const anchors = [[edge, edge], [width * .6, edge],
      [width - edge, height - edge], [edge, height - edge],
      [width - edge, height * .3], [edge, height * .57],
      [width - edge, height * .72], [edge, height * .8],
      [width - edge, edge], [edge, height * .33], [width / 2, height - edge]];
    for (let i = 0; i < anchors.length; i++) {
      const [x, y] = anchors[(preferred + i) % anchors.length];
      if (type === 'tape' && y !== edge) continue;
      const item = { type, x, y, size, rotation }, box = stickerBounds(item);
      if (box.x < 0 || box.y < 0 || box.x + size > width || box.y + size > height ||
          [faceBox, heartBox, ...items.map(stickerBounds)].some(b => overlaps(box, b))) continue;
      items.push(item);
      break;
    }
  }
  return items;
}

function paintSticker(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.rotation);
  ctx.scale(item.size, item.size);
  ctx.fillStyle = '#C51D61';
  ctx.strokeStyle = '#39152A';
  ctx.lineWidth = .012;
  ctx.lineJoin = 'round';
  // Every shape fits a radius of .48, so rotation remains inside size.
  ctx.beginPath();
  if (item.type === 'ribbon') {
    ctx.fillStyle = '#FFF8FB';
    ctx.arc(0, 0, .44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#C51D61';
    ctx.beginPath();
    ctx.moveTo(-.12, -.29); ctx.bezierCurveTo(-.34, -.04, .02, .2, .17, .34);
    ctx.lineTo(.29, .2); ctx.bezierCurveTo(.02, .04, -.18, -.12, -.06, -.23);
    ctx.bezierCurveTo(.15, -.36, .17, -.12, -.28, .23);
    ctx.lineTo(-.14, .34); ctx.bezierCurveTo(.37, -.11, .22, -.44, -.12, -.29); ctx.fill();
  } else if (item.type === 'heart') {
    ctx.moveTo(0, .32); ctx.bezierCurveTo(-.65, -.08, -.23, -.51, 0, -.22);
    ctx.bezierCurveTo(.23, -.51, .65, -.08, 0, .32); ctx.fill();
  } else if (item.type === 'sparkle') {
    ctx.moveTo(0, -.42); ctx.quadraticCurveTo(.07, -.07, .36, 0);
    ctx.quadraticCurveTo(.07, .07, 0, .42); ctx.quadraticCurveTo(-.07, .07, -.36, 0);
    ctx.quadraticCurveTo(-.07, -.07, 0, -.42); ctx.fill();
  } else if (item.type === 'tape') {
    ctx.globalAlpha = .65; ctx.fillStyle = '#F0CEDC';
    ctx.moveTo(-.42, -.13); ctx.lineTo(.4, -.13); ctx.lineTo(.37, -.05);
    ctx.lineTo(.42, .03); ctx.lineTo(.39, .13); ctx.lineTo(-.4, .13);
    ctx.lineTo(-.37, .04); ctx.lineTo(-.42, -.04); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = '#FFF8FB';
    ctx.roundRect(-.43, -.19, .86, .38, item.type === 'stamp' ? .14 : .04);
    ctx.fill();
    if (item.type === 'stamp') ctx.stroke();
    ctx.fillStyle = item.type === 'stamp' ? '#39152A' : '#C51D61';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = item.type === 'stamp' ? '600 .11px "DM Sans", sans-serif' : 'italic 600 .15px "Bodoni Moda", serif';
    ctx.fillText(item.type === 'stamp' ? 'GDG MAHE Dubai' : 'Pink October', 0, 0, .76);
  }
  ctx.restore();
}

// Source is an already cropped/mirrored 9:16 photo. Optional heartStroke is
// an array of pixel-space strokes; omit it when the source already has the heart.
// No DOM, randomness, image downloads, or font loading; accepts OffscreenCanvas.
export function composePortrait(canvas, source, faceBox = null, heartStroke = [], heartBox = null) {
  const width = source.width, height = source.height;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const inset = width * .035, scale = .90;
  const x = width * .05, y = inset;
  const mapBox = b => b && ({ x: x + b.x * scale, y: y + b.y * scale,
    width: b.width * scale, height: b.height * scale });
  const strokeBox = boundsOf(heartStroke.flat());
  const protectedHeart = heartBox ?? (strokeBox && { x: strokeBox.x - width * .009,
    y: strokeBox.y - width * .009, width: strokeBox.width + width * .018,
    height: strokeBox.height + width * .018 });
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, width, height, width * .035); ctx.clip();
  ctx.fillStyle = '#FFF8FB'; ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, width * scale, height * scale, width * .018); ctx.clip();
  ctx.drawImage(source, x, y, width * scale, height * scale);
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = '#C51D61'; ctx.lineWidth = width * .009;
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const stroke of heartStroke) {
    ctx.beginPath(); stroke.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  }
  ctx.restore();
  for (const item of layoutStickers(width, height, mapBox(faceBox), mapBox(protectedHeart))) paintSticker(ctx, item);
  ctx.restore();
  return canvas;
}

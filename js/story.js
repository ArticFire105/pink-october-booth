import { FACTS, SOURCE } from "./awareness-facts.js";
export { SOURCE };
export const FACT = FACTS[0];
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export async function ensureStoryFonts() {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load('600 64px "Bodoni Moda"'),
    document.fonts.load('600 40px "DM Sans"'),
  ]);
}

function linesFor(ctx, text, width) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
    else line = next;
  }
  lines.push(line);
  return lines;
}
export function wrapText(ctx, text, x, y, width, lineHeight) {
  for (const line of linesFor(ctx, text, width)) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}
function rounded(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function heart(ctx, x, y, size, filled = true, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(size / 100, size / 100);
  ctx.beginPath(); ctx.moveTo(0, 38);
  ctx.bezierCurveTo(-15, 20, -57, -8, -38, -33);
  ctx.bezierCurveTo(-24, -49, -5, -33, 0, -16);
  ctx.bezierCurveTo(12, -48, 42, -45, 43, -21);
  ctx.bezierCurveTo(46, 1, 18, 27, 0, 38);
  ctx.fillStyle = "#C2185B"; ctx.strokeStyle = filled ? "#C2185B" : "#E06A9A";
  ctx.lineWidth = filled ? 2 : 6; ctx.lineJoin = "round";
  if (filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}
function sparkle(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s * .15, y - s * .15, x + s, y);
  ctx.quadraticCurveTo(x + s * .15, y + s * .15, x, y + s);
  ctx.quadraticCurveTo(x - s * .15, y + s * .15, x - s, y);
  ctx.quadraticCurveTo(x - s * .15, y - s * .15, x, y - s);
  ctx.fillStyle = "#C64C83"; ctx.fill();
}
function sprig(ctx, x, y, angle) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = "#794255"; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-18, -120, 0, -250); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const y = -30 - i * 43, side = i % 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(-5, y);
    ctx.quadraticCurveTo(side * 54, y - 14, side * 57, y - 66);
    ctx.quadraticCurveTo(side * 14, y - 48, -5, y); ctx.stroke();
  }
  ctx.restore();
}
function paper(ctx) {
  let seed = 202510;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = "#F3C1D3"; ctx.fillRect(0, 0, 1080, 1920);
  const colors = ["#E89AB8", "#F3C1D3", "#D9779F"];
  for (let i = 0; i < 1800; i++) {
    const x = random() * 1080, y = random() * 1920, r = 8 + random() * 115;
    const edge = Math.min(x, 1080 - x, y, 1920 - y) < 90;
    const wash = ctx.createRadialGradient(x, y, 0, x, y, r);
    wash.addColorStop(0, colors[i % 3]); wash.addColorStop(1, colors[i % 3] + "00");
    ctx.globalAlpha = edge ? .19 : .055; ctx.fillStyle = wash;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(248,221,231,.78)"; ctx.fillRect(50, 55, 980, 1810);
}

// Coordinates inside the polaroid are local, so decorations cannot obscure artwork.
export const STORY_NAME_MAX = 16;
// Letters and single spaces only; no leading space; capped length.
export function sanitizeStoryName(value, max = STORY_NAME_MAX) {
  return String(value ?? "").replace(/[^A-Za-z ]+/g, "").replace(/\s+/g, " ").replace(/^ /, "").slice(0, max);
}

export function renderStory(canvas, result) {
  canvas.width = STORY_WIDTH; canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.save(); paper(ctx); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  rounded(ctx, 245, 148, 590, 100, 28, "rgba(255,255,255,.72)");
  ctx.fillStyle = "#442131"; ctx.font = '600 56px "Bodoni Moda", Georgia, serif';
  ctx.fillText("PINK OCTOBER", 508, 198);
  // Folded awareness ribbon, drawn as two tails and an open loop.
  ctx.save(); ctx.translate(785, 195); ctx.strokeStyle = "#DE81A7"; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-15, 29); ctx.bezierCurveTo(22, -13, 15, -34, 0, -32);
  ctx.bezierCurveTo(-19, -30, -17, -8, 17, 29); ctx.stroke(); ctx.restore();

  ctx.save(); ctx.translate(540, 795); ctx.rotate(-5 * Math.PI / 180);
  ctx.shadowColor = "rgba(91,36,59,.22)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 14;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(-365, -400, 730, 845);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const x = -335, y = -370, w = 670, h = 640;
  ctx.fillStyle = "#FFF8FB"; ctx.fillRect(x, y, w, h);
  if (result.artwork?.width > 0 && result.artwork?.height > 0) {
    const image = result.artwork;
    if (result.variant === "photo") {
      const scale = Math.max(w / image.width, h / image.height);
      const sw = w / scale, sh = h / scale;
      ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
    } else {
      const scale = Math.min(w / image.width, h / image.height);
      const iw = image.width * scale, ih = image.height * scale;
      ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }
  } else {
    ctx.fillStyle = "#794255"; ctx.font = '600 54px "Bodoni Moda", Georgia, serif';
    ctx.fillText("Stay curious.", 0, -60);
  }
  ctx.strokeStyle = "#60434E"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  const name = sanitizeStoryName(result.name).trim();
  if (name) {
    // Written on the polaroid's bottom strip, like a caption.
    const caption = `${name}\u2019s heart`;
    let size = 66;
    do { ctx.font = `600 ${size}px "Bodoni Moda", Georgia, serif`; size -= 2; }
    while (size > 24 && ctx.measureText(caption).width > 600);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.save();
    ctx.shadowColor = "rgba(222,129,167,.55)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#A3175A"; ctx.fillText(caption, 0, 358);
    ctx.restore();
    heart(ctx, Math.min(300, ctx.measureText(caption).width / 2 + 34), 340, 26, true, .2);
  }
  ctx.restore();
  // Side ornaments remain beyond the rotated opening (including its corner extents).
  sprig(ctx, 182, 1140, -.28); sprig(ctx, 910, 694, .28);
  heart(ctx, 165, 398, 108, false, -.2); heart(ctx, 884, 332, 105, true, .2);
  heart(ctx, 769, 312, 53, false, -.3); heart(ctx, 135, 551, 59, false, -.3);
  heart(ctx, 228, 1202, 112, true, -.3); heart(ctx, 341, 1205, 51, true, .12);
  heart(ctx, 947, 1036, 62, false, .24); heart(ctx, 955, 913, 39, false, .3);
  for (const [x, y, s] of [[285, 343, 22], [312, 322, 9], [132, 759, 27], [162, 788, 12], [956, 735, 27], [987, 709, 10], [820, 1241, 24]]) sparkle(ctx, x, y, s);

  rounded(ctx, 170, 1310, 740, 370, 56, "rgba(255,255,255,.85)");
  let size = 44, lines;
  do {
    ctx.font = `600 ${size}px "DM Sans", sans-serif`;
    lines = linesFor(ctx, result.fact ?? FACT, 642);
    if (lines.length * size * 1.3 <= 248 && lines.every(line => ctx.measureText(line).width <= 642)) break;
    size -= 1;
  } while (size > 1);
  ctx.fillStyle = "#442131";
  const lineHeight = size * 1.3, top = 1462 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, i) => ctx.fillText(line, 540, top + i * lineHeight));
  ctx.font = '600 23px "DM Sans", sans-serif'; ctx.fillStyle = "#876675";
  ctx.fillText("Source: WHO", 540, 1635);
  ctx.fillStyle = "#442131"; ctx.font = '600 48px "Bodoni Moda", Georgia, serif';
  ctx.fillText("#GDGPinkOctober", 540, 1778);
  ctx.save(); ctx.translate(929, 1778); ctx.strokeStyle = "#794255"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 67, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(0, 0, 61, 0, Math.PI * 2); ctx.stroke();
  heart(ctx, 0, -43, 16); ctx.font = '600 25px "Bodoni Moda", Georgia, serif';
  ctx.fillText("GDG", 0, -17); ctx.fillText("MAHE", 0, 9);
  ctx.font = '19px Georgia, serif'; ctx.fillText("Dubai", 0, 34); ctx.restore();
  ctx.restore(); return canvas;
}

export function pngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error("PNG generation failed"));
  }, "image/png"));
}

// Called directly from a click with a file prepared during preview generation.
export async function shareStory(file, nav, download) {
  try {
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: "Pink October", text: "#GDGPinkOctober" });
      return "shared";
    }
  } catch (error) {
    if (error.name === "AbortError") return "cancelled";
  }
  download();
  return "downloaded";
}

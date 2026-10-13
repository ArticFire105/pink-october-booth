import { paintQR } from "./story-qr.js";
import { FACTS, SOURCE } from "./awareness-facts.js";
export { SOURCE };
export const FACT = FACTS[0];
export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export function wrapText(ctx, text, x, y, width, lineHeight) {
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else line = next;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

// Both drawing and photo artwork are contained, never cropped.
export function renderStory(canvas, result) {
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFF8FB";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#735765";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("PINK OCTOBER", 80, 130);
  ctx.font = "34px sans-serif";
  ctx.fillText("Breast cancer awareness", 80, 190);
  ctx.fillStyle = "#39152A";
  ctx.font = "bold 58px sans-serif";
  wrapText(ctx, "One Heart. One Fact. One Action.", 80, 270, 920, 72);
  ctx.fillStyle = "#F0CEDC";
  ctx.fillRect(80, 470, 920, 650);
  if (result.artwork) {
    const image = result.artwork;
    const scale = Math.min(920 / image.width, 650 / image.height);
    const w = image.width * scale, h = image.height * scale;
    ctx.drawImage(image, 80 + (920 - w) / 2, 470 + (650 - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#39152A";
    ctx.font = "bold 70px sans-serif";
    ctx.fillText("Myth or Fact", 130, 630);
    ctx.font = "bold 110px sans-serif";
    ctx.fillText("Stay curious.", 130, 750);
    ctx.font = "38px sans-serif";
    ctx.fillText("Three questions. One conversation.", 130, 920);
  }
  ctx.fillStyle = "#735765";
  ctx.font = "32px sans-serif";
  ctx.fillText("A heart for breast cancer awareness", 80, 1150);
  ctx.fillStyle = "#39152A";
  ctx.font = "bold 46px sans-serif";
  wrapText(ctx, result.fact ?? FACT, 80, 1230, 920, 60);
  ctx.font = "26px sans-serif";
  ctx.fillText("Source: WHO · who.int/news-room/fact-sheets/", 80, 1440);
  ctx.fillText("detail/breast-cancer", 80, 1475);
  ctx.fillStyle = "#39152A";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("#GDGPinkOctober", 80, 1720);
  paintQR(ctx, SOURCE, 724, 1490, 5);
  ctx.fillStyle = "#735765";
  ctx.font = "23px sans-serif";
  ctx.fillText("Scan: WHO fact sheet", 724, 1740);
  ctx.font = "28px sans-serif";
  ctx.fillText("GDG MAHE Dubai · General awareness only", 80, 1790);
  return canvas;
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

// Landing ribbon "pencil draw": stroke reveals 0→100% while a pencil tip follows the path.
// Replays whenever the landing page becomes visible. Static under prefers-reduced-motion.
export const DRAW_MS = 2300;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export function drawProgress(elapsed, duration = DRAW_MS) {
  return easeInOut(Math.min(1, Math.max(0, elapsed / duration)));
}

function setup() {
  const home = document.querySelector(".home");
  const svg = document.querySelector(".poster-ribbon");
  if (!home || !svg) return;
  const path = svg.querySelector("path");
  const pencil = svg.querySelector(".ribbon-pencil");
  const tip = svg.querySelector(".ribbon-pencil-tip");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const len = path.getTotalLength();
  let raf = 0;

  const finish = () => {
    cancelAnimationFrame(raf);
    path.style.strokeDasharray = "";
    path.style.strokeDashoffset = "";
    pencil.setAttribute("opacity", "0");
    svg.classList.remove("is-drawing");
    svg.classList.add("is-drawn");
  };

  const play = () => {
    cancelAnimationFrame(raf);
    if (reduce.matches || home.hidden) { finish(); return; }
    svg.classList.remove("is-drawn");
    svg.classList.add("is-drawing");
    path.style.strokeDasharray = `${len} ${len}`;
    path.style.strokeDashoffset = `${len}`;
    pencil.setAttribute("opacity", "1");
    const start = performance.now();
    const step = (now) => {
      if (home.hidden) { finish(); return; }
      const p = drawProgress(now - start);
      const at = len * p;
      path.style.strokeDashoffset = `${len - at}`;
      const a = path.getPointAtLength(at);
      const b = path.getPointAtLength(Math.min(len, at + 1));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      // Pencil body trails behind the tip, so rotate it to point along the travel direction.
      tip.setAttribute("transform", `translate(${a.x} ${a.y}) rotate(${angle + 180})`);
      if (p < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
  };

  let wasHidden = home.hidden;
  new MutationObserver(() => {
    if (wasHidden && !home.hidden) play();
    if (home.hidden) finish();
    wasHidden = home.hidden;
  }).observe(home, { attributes: true, attributeFilter: ["hidden"] });
  play();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
}

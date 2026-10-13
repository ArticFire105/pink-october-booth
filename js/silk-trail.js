export const SILK_ENABLED = true;
import { isCameraScreen, onScreenChange } from './effects-gate.js';
// Original landing-only ribbon: damped point chain and a tapered quadratic outline.
export const POINT_COUNT = 28;
export const FADE_MS = 500;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function fadeAlpha(elapsed) {
  return (1 - clamp(elapsed / FADE_MS, 0, 1)) ** 2;
}

export function taperWidth(progress, speed = 0) {
  return (7 + clamp(speed, 0, 24) * 0.22) * (1 - clamp(progress, 0, 1)) ** 0.8;
}

// Returns fresh points; damping and inertia are normalized to a 60 Hz frame.
export function step(points, target, damping = 0.28, delta = 1) {
  const dt = clamp(delta, 0, 2);
  const ease = 1 - (1 - clamp(damping, 0, 1)) ** dt;
  const drag = 0.45 ** dt;
  return points.reduce((next, point, index) => {
    const leader = index ? next[index - 1] : target;
    const vx = (point.vx || 0) * drag + (leader.x - point.x) * ease * (1 - drag);
    const vy = (point.vy || 0) * drag + (leader.y - point.y) * ease * (1 - drag);
    next.push({ x: point.x + vx * dt, y: point.y + vy * dt, vx, vy });
    return next;
  }, []);
}

// Pin the head to the pointer (the heart cursor's hotspot) so the silk flows out of the cursor tip.
export function anchorHead(points, target) {
  if (!target || !points.length) return points;
  const [head, ...rest] = points;
  return [{ ...head, x: target.x, y: target.y, vx: 0, vy: 0 }, ...rest];
}

export function setupSilkTrail({ enabled = SILK_ENABLED } = {}) {
  if (!enabled) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touch = window.matchMedia('(hover: none), (pointer: coarse)');
  if (reduce.matches || touch.matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'silk-trail';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.body.append(canvas);
  let points = [];
  let target = null;
  let frame = 0;
  let lastMove = 0;
  let lastFrame = 0;
  let width = 0;
  let height = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    points = [];
    target = null;
    ctx.clearRect(0, 0, width, height);
  }

  function resize() {
    stop();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function curve(edge) {
    for (let i = 1; i < edge.length - 1; i++) {
      const a = edge[i];
      const b = edge[i + 1];
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    const end = edge[edge.length - 1];
    ctx.lineTo(end.x, end.y);
  }

  function paint(alpha) {
    ctx.clearRect(0, 0, width, height);
    const head = points[0];
    const tail = points[points.length - 1];
    const speed = Math.hypot(head.vx, head.vy);
    const left = [], right = [];
    points.forEach((point, i) => {
      const before = points[Math.max(0, i - 1)];
      const after = points[Math.min(points.length - 1, i + 1)];
      const dx = before.x - after.x, dy = before.y - after.y;
      const length = Math.hypot(dx, dy) || 1;
      const radius = taperWidth(i / (points.length - 1), speed) / 2;
      left.push({ x: point.x - dy / length * radius, y: point.y + dx / length * radius });
      right.push({ x: point.x + dy / length * radius, y: point.y - dx / length * radius });
    });
    const gradient = ctx.createLinearGradient(head.x, head.y, tail.x, tail.y);
    gradient.addColorStop(0, '#C51D61');
    gradient.addColorStop(1, '#F0CEDC');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    curve(left);
    right.reverse();
    ctx.lineTo(right[0].x, right[0].y);
    curve(right);
    ctx.closePath();
    ctx.fill();
  }

  function tick(now) {
    frame = 0;
    if (isCameraScreen() || document.hidden || reduce.matches || touch.matches) { stop(); return; }
    const alpha = fadeAlpha(now - lastMove);
    if (!alpha) { stop(); return; }
    points = anchorHead(step(points, target, 0.28, (now - lastFrame) / (1000 / 60)), target);
    lastFrame = now;
    paint(alpha);
    frame = requestAnimationFrame(tick);
  }

  function move(event) {
    if (isCameraScreen() || document.hidden || reduce.matches || touch.matches || !event.isPrimary) return;
    if (target && target.x === event.clientX && target.y === event.clientY) return;
    target = { x: event.clientX, y: event.clientY };
    lastMove = performance.now();
    if (!points.length) points = Array.from({ length: POINT_COUNT }, () => ({ ...target, vx: 0, vy: 0 }));
    if (!frame) {
      lastFrame = lastMove;
      frame = requestAnimationFrame(tick);
    }
  }

  function visibility() {
    canvas.hidden = isCameraScreen() || document.hidden;
    if (canvas.hidden) stop();
  }
  const unsubscribe = onScreenChange(visibility);
  // Passive input preserves native touch scrolling and button behavior.
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  function dispose() {
    stop();
    unsubscribe();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    reduce.removeEventListener('change', motionChange);
    touch.removeEventListener('change', motionChange);
    canvas.remove();
  }
  function motionChange() { if (reduce.matches || touch.matches) dispose(); }
  reduce.addEventListener('change', motionChange);
  touch.addEventListener('change', motionChange);
  resize();
  visibility();
  return dispose;
}

// Loaded as a module after the markup; the reduced-motion guard installs nothing.
if (typeof window !== 'undefined' && typeof document !== 'undefined') setupSilkTrail();

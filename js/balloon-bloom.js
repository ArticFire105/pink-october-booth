export const BALLOON_CONFIG = Object.freeze({
  enabled: true, palette: 'Pink', mode: 'float', scale: 1,
  softBlur: 0.3, gloss: 0.55, watercolor: 0.35, fadeTime: 2200,
  paperTint: true, dotGrid: false, resetOnLeave: true, maxBalloons: 10,
  customColors: [],
});
import { isCameraScreen, onScreenChange } from './effects-gate.js';

export const PALETTES = Object.freeze({
  'Mixed pinks': ['#C51D61', '#F7A8C8', '#F0CEDC', '#735765'],
  'Warm pinks': ['#C51D61', '#E87B9C', '#F7A8C8'],
  'Cool pinks': ['#735765', '#CE89B4', '#F0CEDC'],
  'Pink': ['#C51D61', '#F7A8C8', '#F0CEDC'],
});
const STORAGE_KEY = 'pink-balloon-settings';

export function mergeSettings(input = {}, base = BALLOON_CONFIG) {
  const result = { ...BALLOON_CONFIG, ...base };
  if (!input || typeof input !== 'object') return result;
  for (const key of ['enabled', 'paperTint', 'dotGrid', 'resetOnLeave'])
    if (typeof input[key] === 'boolean') result[key] = input[key];
  if (Object.hasOwn(PALETTES, input.palette)) result.palette = input.palette;
  if (['float', 'drift'].includes(input.mode)) result.mode = input.mode;
  for (const [key, min, max] of [
    ['scale', 0.5, 2], ['softBlur', 0, 4], ['gloss', 0, 1],
    ['watercolor', 0, 1], ['fadeTime', 500, 10000], ['maxBalloons', 0, 40],
  ]) if (typeof input[key] === 'number' && Number.isFinite(input[key]))
    result[key] = clamp(input[key], min, max);
  result.maxBalloons = Math.floor(result.maxBalloons);
  if (Array.isArray(input.customColors))
    result.customColors = input.customColors.filter(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 20);
  return result;
}

export function pickPalette(settings, random = Math.random()) {
  const colors = settings.customColors?.length ? settings.customColors : PALETTES[settings.palette] || PALETTES.Pink;
  return colors[Math.floor(clamp(random, 0, 0.999999) * colors.length)];
}

export function sizeRange(scale = 1) {
  const safe = Number.isFinite(scale) ? clamp(scale, 0.5, 2) : 1;
  return [40 * safe, 90 * safe];
}

export function driftPath(age, phase = 0, amplitude = 32) {
  return (Math.sin(age / 430 + phase) - Math.sin(phase)) * amplitude
    + (Math.sin(age / 900 + phase) - Math.sin(phase)) * amplitude * 0.4;
}

// Original canvas artwork and motion; independent of the booth's input logic.
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const INTERACTIVE = 'button, a, input, select, summary, [role=button]';


// Accumulate travel, including curved paths. Never burst after a large jump.
export function spawnThrottle(state, point, spacing = 60) {
  if (!state) return { point: { ...point }, distance: 0, spawn: false };
  const distance = state.distance + Math.hypot(point.x - state.point.x, point.y - state.point.y);
  const spawn = distance >= spacing;
  return { point: { ...point }, distance: spawn ? 0 : distance, spawn };
}

export function capBalloons(balloons, limit = 10) {
  const count = Math.max(0, Math.min(10, Math.floor(limit)));
  return count ? balloons.slice(-count) : [];
}

export const PAINT_TIME = 600;

export function revealProgress(timeMs, duration = PAINT_TIME) {
  return clamp(timeMs / Math.max(1, duration), 0, 1);
}

// fadeTime remains the post-paint lifetime, including its final fading interval.
export function lifecyclePhase(age, duration = BALLOON_CONFIG.fadeTime, paintTime = PAINT_TIME) {
  if (age < paintTime) return 'paint';
  if (age < paintTime + duration * 0.6) return 'float';
  if (age < paintTime + duration) return 'fade';
  return 'dead';
}

export function spriteCacheKey(settings, size = 0, color = pickPalette(settings, 0), variant = 0) {
  return JSON.stringify([settings.palette, settings.customColors || [], settings.scale,
    settings.watercolor, size, color.toLowerCase(), variant]);
}

// Absolute age makes both paint and motion independent of display refresh rate.
export function updateBalloon(balloon, now) {
  const age = Math.max(0, now - balloon.born);
  const paintTime = balloon.paintTime ?? PAINT_TIME;
  const movingAge = Math.max(0, age - paintTime);
  const progress = clamp(movingAge / balloon.duration, 0, 1);
  const reveal = revealProgress(age, paintTime);
  return {
    ...balloon, age, reveal, lifecycle: lifecyclePhase(age, balloon.duration, paintTime),
    alive: movingAge < balloon.duration,
    x: balloon.originX + (balloon.mode === 'drift' ? driftPath(movingAge, balloon.phase) : 0),
    y: balloon.originY - progress * balloon.rise,
    scale: 1,
    alpha: reveal === 0 ? 0 : 1 - clamp((progress - 0.6) / 0.4, 0, 1),
  };
}

function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeCanvas(reference, width, height) {
  const canvas = reference.ownerDocument?.createElement('canvas')
    || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : null);
  if (!canvas) throw new Error('Preview requires an ownerDocument or OffscreenCanvas');
  canvas.width = Math.ceil(width * 1.5);
  canvas.height = Math.ceil(height * 1.5);
  canvas.getContext('2d').setTransform(1.5, 0, 0, 1.5, 0, 0);
  return canvas;
}

// Three sizes and three reproducible, irregular silhouettes per palette colour.
// All pigment, granulation and string paths are rasterized once, never in tick().
function createSprite(reference, settings, size, color, variant) {
  const [small, large] = sizeRange(settings.scale);
  const r = (small + (large - small) * size / 2) / 2.44;
  const width = Math.ceil(r * 2 + 18), height = Math.ceil(r * 2.6 + 18);
  const cx = width / 2, cy = r * 1.22 + 9;
  const body = makeCanvas(reference, width, height);
  const ctx = body.getContext('2d');
  const random = randomSource(8317 + size * 91 + variant * 143);
  function outline(expansion = 0) {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const angle = i / 96 * Math.PI * 2;
      const wobble = 1 + 0.018 * Math.sin(angle * 7 + variant)
        + 0.012 * Math.sin(angle * 13 + variant * 2);
      const x = cx + Math.cos(angle) * (r * wobble + expansion) * (1 - 0.09 * Math.sin(angle));
      const y = cy + Math.sin(angle) * (r * 1.22 * wobble + expansion);
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = color;
  // Nested low-opacity outlines provide a diffuse capillary halo without blur.
  for (const spread of [3, 2, 1]) {
    ctx.globalAlpha = 0.025;
    outline(spread); ctx.fill();
  }
  ctx.globalAlpha = 0.22;
  outline(); ctx.fill();
  ctx.save(); outline(); ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  if (ctx.globalCompositeOperation !== 'multiply') ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.025 + random() * (0.045 + settings.watercolor * 0.05);
    ctx.beginPath();
    ctx.ellipse(cx + (random() - 0.5) * r * 1.6, cy + (random() - 0.5) * r * 2,
      r * (0.5 + random() * 0.65), r * (0.4 + random() * 0.65), random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pools at the ragged perimeter, with uneven sediment further inside it.
  ctx.strokeStyle = color;
  for (const [inset, line, alpha] of [[0, 2.5, 0.22], [-1.5, 1.1, 0.12], [-3, 0.6, 0.06]]) {
    ctx.globalAlpha = alpha; ctx.lineWidth = line; outline(inset); ctx.stroke();
  }
  for (let i = 0; i < width * height * 0.6; i++) {
    const x = random() * width, y = random() * height;
    ctx.globalAlpha = 0.035 + random() * 0.13;
    ctx.fillRect(x, y, 0.3 + random() * 0.65, 0.25 + random() * 0.45);
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < width * height * 0.16; i++) {
    ctx.globalAlpha = random() * 0.18;
    ctx.fillRect(random() * width, random() * height, 0.7, 0.4);
  }
  ctx.restore();
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 1.16);
  ctx.lineTo(cx - 2.5, cy + r * 1.35); ctx.lineTo(cx + 2, cy + r * 1.34);
  ctx.closePath(); ctx.fill();
  const stringHeight = 35 * settings.scale;
  const string = makeCanvas(reference, width, stringHeight);
  const sc = string.getContext('2d');
  sc.strokeStyle = '#735765'; sc.globalAlpha = 0.5; sc.lineWidth = 0.65;
  sc.beginPath(); sc.moveTo(cx, 0);
  sc.bezierCurveTo(cx - 8, stringHeight * 0.35, cx + 7, stringHeight * 0.7, cx - 2, stringHeight);
  sc.stroke();
  return { body, string, width, height, cx, cy, stringHeight, stringY: cy + r * 1.33 };
}

function spriteStore(reference) {
  const cache = new Map();
  let signature;
  return (settings, size, color, variant) => {
    const next = spriteCacheKey(settings);
    if (signature !== next) { cache.clear(); signature = next; }
    const key = spriteCacheKey(settings, size, color, variant);
    if (!cache.has(key)) cache.set(key, createSprite(reference, settings, size, color, variant));
    return cache.get(key);
  };
}

function paintBalloon(ctx, b, opacity) {
  const s = b.sprite;
  const left = b.x - s.cx, top = b.y - s.cy;
  const edge = s.height * (1 - b.reveal);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  if (ctx.globalCompositeOperation !== 'multiply') ctx.globalCompositeOperation = 'source-over';
  // Clip-only wet edge: two translucent fringes, then the main wash.
  function clippedWash(offset, alpha, band = false) {
    ctx.save();
    ctx.globalAlpha = b.alpha * opacity * alpha;
    ctx.beginPath(); ctx.rect(left, top + Math.max(0, edge + offset - 3), s.width, s.height); ctx.clip();
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = s.width * i / 16;
      const wave = b.reveal < 1 ? Math.sin(i * 1.7 + b.phase) * 1.2 : 0;
      const y = top + edge + offset + wave;
      if (!i) ctx.moveTo(left + x, y); else ctx.lineTo(left + x, y);
    }
    if (band) {
      for (let i = 16; i >= 0; i--) {
        // A narrow downward run deposits a small trail below the wet edge.
        const drip = i === 9 ? 5 : 0;
        ctx.lineTo(left + s.width * i / 16,
          top + edge + offset + 2 + Math.sin(i * 1.7 + b.phase) * 1.2 + drip);
      }
    } else {
      ctx.lineTo(left + s.width, top + s.height);
      ctx.lineTo(left, top + s.height);
    }
    ctx.closePath(); ctx.clip();
    ctx.drawImage(s.body, left, top, s.width, s.height);
    ctx.restore();
  }
  if (b.reveal > 0) {
    if (b.reveal < 1) { clippedWash(-2, 0.14); clippedWash(-1, 0.22); }
    clippedWash(0, 1);
    if (b.reveal < 1) clippedWash(0.5, 0.65, true);
    ctx.globalAlpha = b.alpha * opacity;
    ctx.beginPath();
    ctx.rect(left, top + s.stringY, s.width, s.stringHeight * b.reveal); ctx.clip();
    ctx.drawImage(s.string, left, top + s.stringY, s.width, s.stringHeight);
  }
  ctx.restore();
}

const previewStores = new WeakMap();
// Deterministic and DOM-independent with an OffscreenCanvas implementation.
// timeMs=350 shows three staggered, partially painted balloons. No rAF or listeners.
export function renderPreviewFrame(canvas, input = {}, timeMs = 350) {
  const settings = mergeSettings(input);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!previewStores.has(canvas)) previewStores.set(canvas, spriteStore(canvas));
  const getSprite = previewStores.get(canvas);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (settings.enabled) for (let i = 0; i < 3; i++) {
    const color = pickPalette(settings, i / 3);
    const b = updateBalloon({ originX: canvas.width * (0.3 + i * 0.19),
      originY: canvas.height * (0.55 + (i % 2) * 0.05), born: i * 70,
      duration: settings.fadeTime, mode: settings.mode, phase: i * 2, rise: 95,
      sprite: getSprite(settings, i, color, i) }, timeMs);
    if (b.alive) paintBalloon(ctx, b, 0.85);
  }
  ctx.restore();
  return canvas;
}

export function setupBalloonBloom(options = {}) {
  let saved = {};
  try { saved = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || '{}'); } catch {}
  let settings = mergeSettings(options, mergeSettings(saved));
  const home = document.getElementById('home');
  const controls = Array.from(document.querySelectorAll?.('[data-balloon-setting]') || []);
  function applySettings() {
    home?.classList?.toggle('balloon-paper', settings.paperTint);
    home?.classList?.toggle('balloon-dots', settings.dotGrid);
    controls.forEach(control => {
      const key = control.dataset.balloonSetting;
      if (control.type === 'checkbox') control.checked = settings[key];
      else control.value = String(settings[key]);
    });
  }
  let reset = () => {};
  function change(event) {
    const control = event.currentTarget;
    const key = control.dataset.balloonSetting;
    const value = control.type === 'checkbox' ? control.checked : key === 'scale' ? Number(control.value) : control.value;
    settings = mergeSettings({ [key]: value }, settings);
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    applySettings();
    reset();
  }
  applySettings();
  controls.forEach(control => control.addEventListener('change', change));
  const removeControls = () => controls.forEach(control => control.removeEventListener('change', change));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return removeControls;
  const canvas = document.createElement('canvas');
  canvas.className = 'balloon-bloom';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return removeControls;
  document.body.append(canvas);
  const getSprite = spriteStore(canvas);
  let balloons = [], throttle = null, frame = 0, width = 0, height = 0;
  const onHome = () => Boolean(home && !home.hidden);

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    balloons = [];
    throttle = null;
    ctx.clearRect(0, 0, width, height);
  }

  reset = () => { stop(); visibility(); };

  function resize() {
    stop();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function tick(now) {
    frame = 0;
    if (isCameraScreen() || !settings.enabled || document.hidden || reduce.matches) { stop(); return; }
    const landing = onHome();
    balloons = capBalloons(balloons, settings.maxBalloons)
      .map(b => updateBalloon(b, now)).filter(b => b.alive);
    ctx.clearRect(0, 0, width, height);
    balloons.forEach(b => paintBalloon(ctx, b, landing ? 0.85 : 0.5));
    if (balloons.length) frame = requestAnimationFrame(tick);
  }

  function move(event) {
    if (isCameraScreen() || !settings.enabled || document.hidden || reduce.matches || event.isPrimary === false) return;
    if (event.target?.closest?.(INTERACTIVE)) { throttle = null; return; }
    throttle = spawnThrottle(throttle, { x: event.clientX, y: event.clientY }, 60);
    if (event.type !== 'pointerdown' && !throttle.spawn) return;
    if (settings.maxBalloons === 0) return;
    throttle.distance = 0;
    const color = pickPalette(settings);
    const sprite = getSprite(settings, Math.floor(Math.random() * 3), color, Math.floor(Math.random() * 3));
    balloons = capBalloons([...balloons, {
      originX: event.clientX + (Math.random() - 0.5) * 20,
      originY: event.clientY + (Math.random() - 0.5) * 14,
      born: performance.now(), duration: settings.fadeTime, mode: settings.mode,
      sprite, rise: 75 + Math.random() * 45,
      phase: Math.random() * Math.PI * 2,
      color,
    }], settings.maxBalloons);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function visibility() {
    canvas.hidden = document.hidden || isCameraScreen() || !settings.enabled;
    if (canvas.hidden) stop();
  }
  function motionChange() { if (reduce.matches) dispose(); }
  function leave(event) { if (settings.resetOnLeave && !event.relatedTarget) stop(); }
  const unsubscribe = onScreenChange(visibility);
  function dispose() {
    stop();
    unsubscribe();
    removeControls();
    window.removeEventListener('pointerdown', move);
    window.removeEventListener('pointerout', leave);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    reduce.removeEventListener('change', motionChange);
    canvas.remove();
  }
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', move, { passive: true });
  window.addEventListener('pointerout', leave);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  reduce.addEventListener('change', motionChange);
  resize();
  visibility();
  return dispose;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') setupBalloonBloom();

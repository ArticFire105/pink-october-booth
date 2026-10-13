import { createHeartWall } from './heart-wall.js';
import { createIdleDemo } from './idle-demo.js';
import { setupLandingCounter } from './landing-motion.js';

export function setupBoothExtras(counters, state) {
  let storage;
  try { storage = window.localStorage; } catch { /* Optional storage. */ }
  const home = document.getElementById('home');
  const landingCount = home.querySelector('[data-booth-count]');
  const updateLandingCount = setupLandingCounter(home, landingCount);
  const wall = createHeartWall(storage);
  const idle = createIdleDemo();
  const demo = document.getElementById('idle-demo');
  const row = document.getElementById('heart-wall');
  const resetIdle = () => { idle.reset(performance.now()); demo.hidden = true; };
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'touchmove', 'wheel']) {
    document.addEventListener(type, resetIdle, { passive: true, capture: true });
  }
  function refresh() {
    const count = counters.today();
    for (const line of document.querySelectorAll('[data-booth-count]')) {
      if (line === landingCount) continue;
      line.textContent = `${count} ${count === 1 ? 'heart' : 'hearts'} drawn today`;
    }
    updateLandingCount(count);
    row.replaceChildren();
    for (const strokes of wall.snapshot()) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.setProperty('--heart-index', row.childElementCount);
      svg.setAttribute('viewBox', '-.1 -.1 1.2 1.2');
      svg.setAttribute('aria-hidden', 'true');
      for (const stroke of strokes) {
        const path = document.createElementNS(svg.namespaceURI, 'polyline');
        path.setAttribute('points', stroke.map(p => `${p.x},${p.y}`).join(' '));
        svg.append(path);
      }
      row.append(svg);
    }
    row.hidden = !row.childElementCount;
  }
  document.getElementById('wall-reset').onclick = () => { wall.reset(); refresh(); };
  resetIdle();
  refresh();
  let lastCount = counters.today();
  setInterval(() => {
    demo.hidden = !idle.visible({ now: performance.now(), landing: state.mode === 'home' && !document.hidden && !document.getElementById('stats').open, handDetected: state.hands.length > 0 });
    const count = counters.today();
    if (count !== lastCount) { lastCount = count; refresh(); }
  }, 250);
  return {
    refresh,
    leave: resetIdle,
    add(strokes) { wall.add(strokes); refresh(); },
    reset() { wall.reset(); refresh(); },
  };
}

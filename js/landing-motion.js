// A bounded, time-based presentation value; never changes the stored tally.
export function counterTick(total, progress) {
  if (!Number.isSafeInteger(total) || total < 0) return 0;
  const t = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.floor(total * (1 - (1 - t) ** 3));
}

export function setupLandingCounter(home, line) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let total = 0;
  let frame = 0;
  const paint = value => { line.textContent = `${value} ${value === 1 ? 'heart' : 'hearts'} drawn today`; };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const render = () => {
    stop();
    if (home.hidden || document.hidden || reduced.matches || total === 0) { paint(total); return; }
    paint(0);
    const start = performance.now();
    const tick = now => {
      if (home.hidden || document.hidden || reduced.matches) { stop(); paint(total); return; }
      const progress = Math.min(1, (now - start) / 1100);
      paint(counterTick(total, progress));
      frame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  };
  new MutationObserver(render).observe(home, { attributes: true, attributeFilter: ['hidden'] });
  reduced.addEventListener('change', render);
  document.addEventListener('visibilitychange', render);
  return value => { total = value; render(); };
}

export const MUTE_KEY = 'gdg-pink-october-muted';
export function readMuted(storage) {
  try { return storage?.getItem(MUTE_KEY) === 'true'; } catch { return false; }
}
export function writeMuted(storage, muted) {
  try { storage?.setItem(MUTE_KEY, String(muted)); } catch { /* Optional storage. */ }
}

export function setupFinishEffects(toggle, ribbon) {
  let storage, context;
  try { storage = window.localStorage; } catch { /* Optional storage. */ }
  toggle.checked = readMuted(storage);
  function unlock() {
    if (toggle.checked) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      context ??= new Audio();
      context.resume()?.catch(() => {});
    } catch { /* Audio is optional. */ }
  }
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  toggle.addEventListener('change', () => {
    writeMuted(storage, toggle.checked);
    if (toggle.checked) context?.suspend()?.catch(() => {});
    else unlock();
  });
  return () => {
    ribbon.getAnimations?.().forEach(animation => animation.cancel());
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ribbon.animate?.([{ opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)', offset: .25 },
        { opacity: 0, transform: 'translateY(-4px)' }], { duration: 1200 });
    }
    if (toggle.checked || context?.state !== 'running') return;
    try {
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.025, now + .03);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .55);
      gain.connect(context.destination);
      const tone = context.createOscillator();
      tone.type = 'sine';
      tone.frequency.value = 660;
      tone.connect(gain);
      tone.onended = () => { tone.disconnect(); gain.disconnect(); };
      tone.start(now);
      tone.stop(now + .6);
    } catch { /* Never interrupt completion for audio. */ }
  };
}

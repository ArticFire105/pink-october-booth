import { FACTS, SOURCE } from "./awareness-facts.js";

export function createFactRotator(facts = FACTS, source = SOURCE) {
  let index = 0;
  const state = { current: Object.freeze({ text: facts[0], source }), locked: false };
  return {
    get state() { return { ...state }; },
    current() { return state.current; },
    next() {
      if (!state.locked) {
        index = (index + 1) % facts.length;
        state.current = Object.freeze({ text: facts[index], source });
      }
      return state.current;
    },
    lock() { state.locked = true; return state.current; },
    unlock() { state.locked = false; },
  };
}

// Always paint fresh, opaque text from state, independent of screen animation.
export function renderPhotoFact(ctx, fact, width, height) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#FFF8FB";
  ctx.fillRect(0, height - 230, width, 230);
  ctx.fillStyle = "#39152A";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "32px sans-serif";
  ctx.fillText(fact.text, 40, height - 195, width - 80);
  ctx.font = "22px sans-serif";
  ctx.fillText("Source: WHO", 40, height - 125);
  ctx.fillText(fact.source, 40, height - 85, width - 80);
  ctx.restore();
}

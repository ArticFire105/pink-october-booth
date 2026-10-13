import { FACTS, SOURCE } from "./awareness-facts.js";

const LAST_KEY = "pob-last-fact-start";
function defaultStorage() { try { return globalThis.localStorage ?? null; } catch { return null; } }

// Fisher–Yates shuffle with an injectable random source.
export function shuffled(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Rotates facts in a shuffled order that starts at a random fact each round
// (avoiding the previous round's start) and never shows the same fact twice in a row.
export function createFactRotator(facts = FACTS, source = SOURCE,
  { random = Math.random, storage = defaultStorage() } = {}) {
  let order = [], index = 0;
  const state = { current: null, locked: false };
  const set = text => { state.current = Object.freeze({ text, source }); };
  function readLast() { try { return storage?.getItem(LAST_KEY) ?? null; } catch { return null; } }
  function shuffle(avoidFirst) {
    order = shuffled(facts, random);
    if (order.length > 1 && order[0] === avoidFirst) {
      const k = 1 + Math.floor(random() * (order.length - 1));
      [order[0], order[k]] = [order[k], order[0]];
    }
  }
  function reset() {
    if (state.locked) return state.current;
    shuffle(readLast());
    index = 0;
    set(order[0]);
    try { storage?.setItem(LAST_KEY, order[0]); } catch {}
    return state.current;
  }
  reset();
  return {
    get state() { return { ...state }; },
    get order() { return order.slice(); },
    current() { return state.current; },
    reset,
    next() {
      if (!state.locked) {
        index += 1;
        if (index >= order.length) { shuffle(order[order.length - 1]); index = 0; }
        set(order[index]);
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

import { nextFromBag } from './shuffle-bag.js';
export const SOURCE = 'https://www.who.int/news-room/fact-sheets/detail/breast-cancer';
// Checked against the WHO breast cancer fact sheet, 13 October 2026.
// General awareness statements, without personal medical advice.
export const FACTS = Object.freeze([
  'Early diagnosis and timely treatment can improve breast cancer outcomes.',
  'Breast cancer can also affect men.',
  'Most breast lumps are not cancer.',
  'A breast cancer lump can be painless.',
  'Breast cancer occurs in every country.',
  'Breast cancer becomes more common with increasing age.',
  'Most women diagnosed with breast cancer have no known family history of it.',
  'Breast cancer can cause changes in breast skin or nipple appearance.',
]);
export const FACTS_KEY = 'pink-october-facts-v1';
export function createFactBag(storage, random = Math.random) {
  let remaining = [];
  try { remaining = JSON.parse(storage?.getItem(FACTS_KEY)) ?? []; } catch { /* Optional storage. */ }
  return {
    next() {
      const draw = nextFromBag(FACTS.length, remaining, random);
      remaining = draw.remaining;
      try { storage?.setItem(FACTS_KEY, JSON.stringify(remaining)); } catch { /* Keep in memory. */ }
      return FACTS[draw.index];
    },
  };
}

import { shuffle } from './shuffle-bag.js';
// Legacy tilt outputs myth/fact remain the left/right input channels.
export function pickQuestions(bank, count = 4, random = Math.random) {
  if (!Array.isArray(bank) || bank.some(row => !Array.isArray(row) || row.length !== 3 ||
      row.some(text => typeof text !== 'string' || !text.trim()))) throw new TypeError('Invalid question bank');
  const unique = [...new Map(bank.map(row => [row[0], row])).values()];
  if (!Number.isInteger(count) || count < 1 || count > unique.length) throw new RangeError('Not enough unique questions');
  return shuffle(unique, random).slice(0, count).map(([prompt, correct, wrong]) => {
    const answer = random() < 0.5 ? 'myth' : 'fact';
    return { prompt, answer, correct, left: answer === 'myth' ? correct : wrong,
      right: answer === 'fact' ? correct : wrong };
  });
}

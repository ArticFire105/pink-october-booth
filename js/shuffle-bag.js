// Pure Fisher–Yates shuffle; the RNG is injectable and input is never mutated.
export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function nextFromBag(size, remaining = [], random = Math.random) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('Empty pool');
  const valid = Array.isArray(remaining) && new Set(remaining).size === remaining.length &&
    remaining.every(i => Number.isInteger(i) && i >= 0 && i < size);
  const bag = valid && remaining.length ? [...remaining] : shuffle(Array.from({ length: size }, (_, i) => i), random);
  return { index: bag.pop(), remaining: bag };
}

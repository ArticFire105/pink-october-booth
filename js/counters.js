import { heartsToday, recordDailyHeart } from "./daily-count.js";
export const COUNTERS_KEY = "pink-october-counters-v1";
const names = ["sessions", "draw", "quiz", "exports"];
const empty = () => ({ version: 1, counts: Object.fromEntries(names.map(k => [k, 0])), active: null, daily: null });
const validFlags = a => a === null || (a && ["draw", "quiz", "exports"].every(k => typeof a[k] === "boolean"));

// One booth tab: bounded totals and current-visitor flags, never visitor artwork.
export function createCounters(storage, now = () => new Date()) {
  let data = empty(), warning = "";
  try {
    const raw = storage.getItem(COUNTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !names.every(k => Number.isSafeInteger(parsed.counts?.[k]) && parsed.counts[k] >= 0) || !validFlags(parsed.active)) throw new Error("Invalid counters");
      data.daily = parsed.daily ?? null;
      data.counts = Object.fromEntries(names.map(k => [k, parsed.counts[k]]));
      data.active = parsed.active === null ? null : Object.fromEntries(["draw", "quiz", "exports"].map(k => [k, parsed.active[k]]));
    }
  } catch { warning = "Stored counters unavailable or invalid. Counts are in memory; export CSV before closing."; }
  function persist() {
    try { storage.setItem(COUNTERS_KEY, JSON.stringify(data)); }
    catch { warning = "Counters could not be saved. Counts are in memory; export CSV before closing."; }
  }
  return {
    start() {
      if (data.active) return;
      data.active = { draw: false, quiz: false, exports: false };
      data.counts.sessions++;
      persist();
    },
    record(kind) {
      if (!data.active || !Object.hasOwn(data.active, kind) || data.active[kind]) return;
      data.active[kind] = true;
      data.counts[kind]++;
      if (kind === "draw") data.daily = recordDailyHeart(data.daily, now());
      persist();
    },
    nextVisitor() { data.active = null; persist(); },
    reset() { data = empty(); warning = ""; persist(); },
    today() { return heartsToday(data.daily, now()); },
    snapshot() { return { ...data.counts }; },
    get warning() { return warning; },
    csv() { return "metric,count\r\n" + names.map(k => `${k},${data.counts[k]}\r\n`).join(""); },
  };
}

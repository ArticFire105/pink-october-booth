import { createCounters } from "./counters.js";

export function setupStats(onReset) {
  let storage;
  try { storage = window.localStorage; } catch { /* In-memory fallback is reported below. */ }
  const counters = createCounters(storage);
  const dialog = document.getElementById("stats");
  function refresh() {
    const counts = counters.snapshot();
    for (const key of Object.keys(counts)) document.getElementById(`count-${key}`).textContent = counts[key];
    document.getElementById("storage-warning").textContent = counters.warning;
  }
  function open() { refresh(); if (!dialog.open) dialog.showModal(); }
  document.getElementById("stats-open").onclick = open;
  document.addEventListener("keydown", event => {
    if (event.key.toLowerCase() !== "s" || event.ctrlKey || event.metaKey || event.altKey || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    event.preventDefault();
    open();
  });
  document.getElementById("stats-close").onclick = () => dialog.close();
  document.getElementById("stats-csv").onclick = () => {
    const url = URL.createObjectURL(new Blob([counters.csv()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "pink-october-stats.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.getElementById("stats-reset").onclick = () => {
    if (!window.confirm("Reset all event counters on this device? Export CSV first if you need these totals. This cannot be undone.")) return;
    onReset();
    counters.reset();
    refresh();
  };
  return counters;
}

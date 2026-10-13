export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function heartsToday(daily, date = new Date()) {
  return daily?.date === localDateKey(date) && Number.isSafeInteger(daily.draw) && daily.draw >= 0 ? daily.draw : 0;
}
export function recordDailyHeart(daily, date = new Date()) {
  return { date: localDateKey(date), draw: heartsToday(daily, date) + 1 };
}

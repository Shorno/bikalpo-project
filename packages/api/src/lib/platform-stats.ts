/** Bangladesh calendar-day boundaries, independent of the server's timezone. */
export function platformDayRange(now = new Date()) {
  const offset = 6 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * Timezone-safe local date helpers.
 *
 * `new Date().toISOString().slice(0, 10)` converts to UTC first, so at
 * 1 AM Bangladesh (UTC+6) on April 1st it yields "2026-03-31".
 * These helpers use local time instead.
 */

/** Returns today's date as "YYYY-MM-DD" in local timezone */
export function localDateString(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/** Returns today's date as "YYYYMMDD" in local timezone (for generating IDs) */
export function localDateStamp(date: Date = new Date()): string {
    return localDateString(date).replace(/-/g, "");
}

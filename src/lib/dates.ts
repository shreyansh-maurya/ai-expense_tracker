// All dates are stored as UTC midnight of the calendar date to avoid timezone drift.
// "Today"/current month use the server's local timezone (single-user local app).

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isValidUTCDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d;
}

/** ISO date string "YYYY-MM-DD" -> Date at UTC midnight. Returns null if invalid. */
export function parseUTCMidnight(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!isValidUTCDate(y, mo, d)) return null;
  return new Date(Date.UTC(y, mo, d));
}

/** Date (at UTC midnight) -> "YYYY-MM-DD" using UTC parts. */
export function dateToISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Month key "YYYY-MM" from a stored date (UTC parts). */
export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/** Today's calendar date in the server's local timezone, as "YYYY-MM-DD". */
export function todayISODate(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

/** Current month key based on local timezone. */
export function currentMonthKey(): string {
  return todayISODate().slice(0, 7);
}

/** "YYYY-MM" -> { start: Date (UTC midnight of 1st), end: Date (exclusive, UTC midnight of 1st of next month) }. */
export function monthRange(monthKey: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) throw new Error(`Invalid month key: ${monthKey}`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  return { start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 1)) };
}

/** Shift a month key by delta months, e.g. ("2026-10", -1) -> "2026-09". */
export function addMonthKeys(monthKey: string, delta: number): string {
  const { start } = monthRange(monthKey);
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
  return monthKeyOf(d);
}

/** Last n month keys (including `endKey`), oldest first. */
export function lastNMonthKeys(n: number, endKey = currentMonthKey()): string[] {
  return Array.from({ length: n }, (_, i) => addMonthKeys(endKey, -(n - 1 - i)));
}

/** "2026-10" -> "Oct 2026". */
export function monthKeyLabel(monthKey: string): string {
  const { start } = monthRange(monthKey);
  return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

/** Number of days in the month. */
export function daysInMonth(monthKey: string): number {
  const { start, end } = monthRange(monthKey);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Stored date -> "06 Oct 2026" (UTC parts — never shifted). */
export function formatDayLabel(d: Date): string {
  return `${pad2(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const MONTH_LOOKUP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a date string in any of the accepted formats into ISO "YYYY-MM-DD".
 * Accepts: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, "6 Oct 2026", "06 October 2026".
 * Day-first (Indian convention) is assumed for numeric slash/dash formats.
 * Returns null if unparseable or not a real calendar date.
 */
export function parseFlexibleDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  let y: number, mo: number, d: number;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    y = Number(m[1]); mo = Number(m[2]) - 1; d = Number(m[3]);
  } else if ((m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) {
    // DD/MM/YYYY or DD-MM-YYYY (day-first; Indian convention)
    d = Number(m[1]); mo = Number(m[2]) - 1; y = Number(m[3]);
  } else if ((m = /^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{4})$/.exec(s))) {
    const month = MONTH_LOOKUP[m[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    d = Number(m[1]); mo = month; y = Number(m[3]);
  } else {
    return null;
  }

  if (!isValidUTCDate(y, mo, d)) return null;
  return `${y}-${pad2(mo + 1)}-${pad2(d)}`;
}

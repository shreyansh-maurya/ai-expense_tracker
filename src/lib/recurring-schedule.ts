// Recurring-expense schedule math (Phase C).
//
// Everything here is pure: UTC-midnight Date in, UTC-midnight Date out, no I/O,
// so it can be unit-tested without a database. Storage semantics mirror
// `Expense.date` — calendar dates kept at UTC midnight.
//
// Monthly/yearly schedules are always computed from the original anchor
// (startDate), never from the previous occurrence, so a Jan-31 schedule yields
// Feb 28 → Mar 31 rather than drifting forward through short months.

import { dateToISODate } from "@/lib/dates";

export const RECURRING_FREQUENCIES = ["WEEKLY", "MONTHLY", "YEARLY"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const DAY_MS = 86_400_000;

/** Hard cap on occurrences materialized per template per run (runaway guard). */
export const MAX_OCCURRENCES_PER_RUN = 500;

/** Scan bound for monthly/yearly index lookup — ~1000 years of months. */
const MAX_SCAN = 12_000;

export function isRecurringFrequency(v: unknown): v is RecurringFrequency {
  return typeof v === "string" && (RECURRING_FREQUENCIES as readonly string[]).includes(v);
}

function normInterval(interval: number): number {
  const n = Math.trunc(Number(interval));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function daysInMonthUTC(year: number, month: number): number {
  // Day 0 of the next month = last day of `month`.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Date at UTC midnight with the day clamped into the month (Jan 31 → Feb 28/29). */
function clampedDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonthUTC(year, month))));
}

/** The n-th occurrence (0-based) of a schedule anchored at `startDate`. */
export function nthOccurrence(
  anchor: Date,
  frequency: RecurringFrequency,
  interval: number,
  n: number
): Date {
  const iv = normInterval(interval);
  const idx = Math.max(0, Math.trunc(n));
  switch (frequency) {
    case "WEEKLY":
      return new Date(anchor.getTime() + idx * iv * 7 * DAY_MS);
    case "MONTHLY": {
      const totalMonths = anchor.getUTCMonth() + idx * iv;
      const year = anchor.getUTCFullYear() + Math.floor(totalMonths / 12);
      const month = ((totalMonths % 12) + 12) % 12;
      return clampedDay(year, month, anchor.getUTCDate());
    }
    case "YEARLY":
      return clampedDay(anchor.getUTCFullYear() + idx * iv, anchor.getUTCMonth(), anchor.getUTCDate());
  }
}

/** Smallest n ≥ 0 whose occurrence is ≥ `onOrAfter`, or -1 beyond the scan bound. */
export function occurrenceIndexOnOrAfter(
  anchor: Date,
  frequency: RecurringFrequency,
  interval: number,
  onOrAfter: Date
): number {
  if (frequency === "WEEKLY") {
    const stepMs = normInterval(interval) * 7 * DAY_MS;
    const diff = onOrAfter.getTime() - anchor.getTime();
    return diff <= 0 ? 0 : Math.ceil(diff / stepMs);
  }
  // Occurrences are strictly increasing and at most ~1 month/year apart,
  // so a bounded forward scan from the anchor always terminates.
  for (let n = 0; n <= MAX_SCAN; n++) {
    if (nthOccurrence(anchor, frequency, interval, n).getTime() >= onOrAfter.getTime()) return n;
  }
  return -1;
}

/** First occurrence strictly after `after`, or null when the schedule can't advance. */
export function nextOccurrenceAfter(
  anchor: Date,
  frequency: RecurringFrequency,
  interval: number,
  after: Date
): Date | null {
  const n = occurrenceIndexOnOrAfter(anchor, frequency, interval, new Date(after.getTime() + DAY_MS));
  return n < 0 ? null : nthOccurrence(anchor, frequency, interval, n);
}

export type OccurrencePlan = {
  /** Pending occurrences to materialize now — every one is ≤ today and ≤ endDate. */
  due: Date[];
  /** The occurrence after those, or null when nothing more will ever be due. */
  next: Date | null;
  /** True when the schedule has no further occurrence (endDate passed / unadvanceable). */
  exhausted: boolean;
};

/**
 * Work out what a template still owes us as of `today`.
 *
 * `nextDate` is the next not-yet-materialized occurrence; we walk the schedule
 * from there while the occurrence is due (≤ today) and allowed (≤ endDate),
 * capped at `limit` per call so a long-dormant template can't flood the DB in
 * one request — the remainder is picked up on the next run.
 */
export function planOccurrences({
  anchor,
  frequency,
  interval,
  nextDate,
  endDate,
  today,
  limit = MAX_OCCURRENCES_PER_RUN,
}: {
  anchor: Date;
  frequency: RecurringFrequency;
  interval: number;
  nextDate: Date;
  endDate: Date | null;
  today: Date;
  limit?: number;
}): OccurrencePlan {
  const due: Date[] = [];
  let cursor: Date | null = nextDate;

  while (
    cursor !== null &&
    cursor.getTime() <= today.getTime() &&
    (endDate === null || cursor.getTime() <= endDate.getTime()) &&
    due.length < limit
  ) {
    due.push(cursor);
    cursor = nextOccurrenceAfter(anchor, frequency, interval, cursor);
  }

  if (cursor === null) return { due, next: null, exhausted: true };
  if (endDate !== null && cursor.getTime() > endDate.getTime()) {
    return { due, next: null, exhausted: true };
  }
  return { due, next: cursor, exhausted: false };
}

/** Human label for the repeat rule, e.g. "Every 2 weeks", "Every month". */
export function describeSchedule(frequency: RecurringFrequency, interval: number): string {
  const iv = normInterval(interval);
  if (iv === 1) {
    return { WEEKLY: "Every week", MONTHLY: "Every month", YEARLY: "Every year" }[frequency];
  }
  const unit = { WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" }[frequency];
  return `Every ${iv} ${unit}`;
}

/** Convenience for tests/UI: occurrence as "YYYY-MM-DD". */
export function occurrenceISO(
  anchor: Date,
  frequency: RecurringFrequency,
  interval: number,
  n: number
): string {
  return dateToISODate(nthOccurrence(anchor, frequency, interval, n));
}

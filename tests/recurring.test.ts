import { describe, expect, it } from "vitest";
import { parseUTCMidnight } from "../src/lib/dates";
import {
  describeSchedule,
  nextOccurrenceAfter,
  nthOccurrence,
  occurrenceIndexOnOrAfter,
  planOccurrences,
  type RecurringFrequency,
} from "../src/lib/recurring-schedule";

const d = (iso: string) => parseUTCMidnight(iso)!;
const iso = (dt: Date) =>
  `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

describe("nthOccurrence", () => {
  it("steps weekly by 7 days × interval", () => {
    const a = d("2026-10-06");
    expect(iso(nthOccurrence(a, "WEEKLY", 1, 0))).toBe("2026-10-06");
    expect(iso(nthOccurrence(a, "WEEKLY", 1, 1))).toBe("2026-10-13");
    expect(iso(nthOccurrence(a, "WEEKLY", 2, 3))).toBe("2026-11-17"); // 6 weeks later
    expect(iso(nthOccurrence(a, "WEEKLY", 1, 52))).toBe("2027-10-05");
  });

  it("steps monthly from the anchor and clamps short months", () => {
    const a = d("2026-01-31");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 0))).toBe("2026-01-31");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 1))).toBe("2026-02-28"); // non-leap Feb
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 2))).toBe("2026-03-31"); // returns to the 31st
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 3))).toBe("2026-04-30");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 4))).toBe("2026-05-31");
  });

  it("clamps to Feb 29 in leap years and back afterwards", () => {
    const a = d("2028-01-31");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 1))).toBe("2028-02-29");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 2))).toBe("2028-03-31");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 12))).toBe("2029-01-31");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 13))).toBe("2029-02-28");
    expect(iso(nthOccurrence(a, "MONTHLY", 1, 14))).toBe("2029-03-31");
  });

  it("supports intervals > 1 and rolls across year boundaries", () => {
    const a = d("2026-11-15");
    expect(iso(nthOccurrence(a, "MONTHLY", 3, 1))).toBe("2027-02-15");
    expect(iso(nthOccurrence(a, "MONTHLY", 3, 2))).toBe("2027-05-15");
    expect(iso(nthOccurrence(a, "MONTHLY", 3, 5))).toBe("2028-02-15");
  });

  it("steps yearly with Feb 29 clamping", () => {
    const a = d("2028-02-29");
    expect(iso(nthOccurrence(a, "YEARLY", 1, 0))).toBe("2028-02-29");
    expect(iso(nthOccurrence(a, "YEARLY", 1, 1))).toBe("2029-02-28");
    expect(iso(nthOccurrence(a, "YEARLY", 1, 2))).toBe("2030-02-28");
    expect(iso(nthOccurrence(a, "YEARLY", 1, 4))).toBe("2032-02-29");
    expect(iso(nthOccurrence(a, "YEARLY", 2, 2))).toBe("2032-02-29");
  });
});

describe("occurrenceIndexOnOrAfter", () => {
  it("returns 0 for targets on or before the anchor", () => {
    const a = d("2026-10-06");
    expect(occurrenceIndexOnOrAfter(a, "MONTHLY", 1, d("2026-09-01"))).toBe(0);
    expect(occurrenceIndexOnOrAfter(a, "MONTHLY", 1, d("2026-10-06"))).toBe(0);
    expect(occurrenceIndexOnOrAfter(a, "WEEKLY", 1, d("2026-10-06"))).toBe(0);
  });

  it("finds the exact and the next occurrence", () => {
    const m = d("2026-01-31");
    expect(occurrenceIndexOnOrAfter(m, "MONTHLY", 1, d("2026-03-31"))).toBe(2);
    expect(occurrenceIndexOnOrAfter(m, "MONTHLY", 1, d("2026-03-01"))).toBe(2); // Feb 28 < Mar 1 → Mar 31

    const w = d("2026-10-06"); // biweekly schedule anchor
    expect(occurrenceIndexOnOrAfter(w, "WEEKLY", 2, d("2026-10-06"))).toBe(0);
    expect(occurrenceIndexOnOrAfter(w, "WEEKLY", 2, d("2026-10-20"))).toBe(1); // exact 2-week mark
    expect(occurrenceIndexOnOrAfter(w, "WEEKLY", 2, d("2026-10-21"))).toBe(2); // 20th already passed
  });
});

describe("nextOccurrenceAfter", () => {
  it("is strictly after the given day", () => {
    const w = d("2026-10-06");
    expect(iso(nextOccurrenceAfter(w, "WEEKLY", 1, d("2026-10-06"))!)).toBe("2026-10-13");

    const m = d("2026-01-31");
    expect(iso(nextOccurrenceAfter(m, "MONTHLY", 1, d("2026-01-31"))!)).toBe("2026-02-28");
    expect(iso(nextOccurrenceAfter(m, "MONTHLY", 1, d("2026-02-27"))!)).toBe("2026-02-28");
    expect(iso(nextOccurrenceAfter(m, "MONTHLY", 1, d("2026-02-28"))!)).toBe("2026-03-31");
  });
});

describe("planOccurrences", () => {
  const base = {
    anchor: d("2026-01-31"),
    frequency: "MONTHLY" as RecurringFrequency,
    interval: 1,
    endDate: null as Date | null,
  };

  it("materializes nothing before the first occurrence", () => {
    const p = planOccurrences({ ...base, nextDate: d("2026-11-30"), today: d("2026-10-13") });
    expect(p.due).toEqual([]);
    expect(iso(p.next!)).toBe("2026-11-30");
    expect(p.exhausted).toBe(false);
  });

  it("collects every past-due occurrence up to today", () => {
    const p = planOccurrences({ ...base, nextDate: d("2026-01-31"), today: d("2026-04-15") });
    expect(p.due.map(iso)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(iso(p.next!)).toBe("2026-04-30");
    expect(p.exhausted).toBe(false);
  });

  it("includes an occurrence landing exactly today", () => {
    const p = planOccurrences({ ...base, nextDate: d("2026-04-30"), today: d("2026-04-30") });
    expect(p.due.map(iso)).toEqual(["2026-04-30"]);
    expect(iso(p.next!)).toBe("2026-05-31");
  });

  it("stops at endDate and reports exhaustion", () => {
    const p = planOccurrences({
      ...base,
      nextDate: d("2026-01-31"),
      endDate: d("2026-03-15"),
      today: d("2026-08-01"),
    });
    expect(p.due.map(iso)).toEqual(["2026-01-31", "2026-02-28"]);
    expect(p.next).toBeNull();
    expect(p.exhausted).toBe(true);
  });

  it("is exhausted when the whole schedule ended in the past", () => {
    const p = planOccurrences({
      ...base,
      nextDate: d("2026-01-31"),
      endDate: d("2026-01-31"),
      today: d("2026-10-13"),
    });
    expect(p.due.map(iso)).toEqual(["2026-01-31"]);
    expect(p.exhausted).toBe(true);
  });

  it("caps work per run without marking the schedule exhausted", () => {
    const p = planOccurrences({
      anchor: d("2020-01-01"),
      frequency: "WEEKLY",
      interval: 1,
      nextDate: d("2020-01-01"),
      endDate: null,
      today: d("2026-10-13"),
      limit: 10,
    });
    expect(p.due).toHaveLength(10);
    expect(iso(p.next!)).toBe("2020-03-11"); // anchor + 10 weeks
    expect(p.exhausted).toBe(false);
  });

  it("treats endDate before the start as already finished", () => {
    const p = planOccurrences({
      ...base,
      nextDate: d("2026-11-30"),
      endDate: d("2026-10-01"),
      today: d("2026-10-13"),
    });
    expect(p.due).toEqual([]);
    expect(p.exhausted).toBe(true);
  });
});

describe("describeSchedule", () => {
  it("labels intervals", () => {
    expect(describeSchedule("WEEKLY", 1)).toBe("Every week");
    expect(describeSchedule("WEEKLY", 2)).toBe("Every 2 weeks");
    expect(describeSchedule("MONTHLY", 1)).toBe("Every month");
    expect(describeSchedule("MONTHLY", 6)).toBe("Every 6 months");
    expect(describeSchedule("YEARLY", 1)).toBe("Every year");
  });
});

import { describe, expect, it } from "vitest";
import {
  addMonthKeys,
  dateToISODate,
  daysInMonth,
  formatDayLabel,
  lastNMonthKeys,
  monthKeyLabel,
  monthKeyOf,
  monthRange,
  parseFlexibleDate,
  parseUTCMidnight,
} from "../src/lib/dates";

describe("parseUTCMidnight / dateToISODate", () => {
  it("round-trips ISO dates", () => {
    const d = parseUTCMidnight("2026-10-06")!;
    expect(dateToISODate(d)).toBe("2026-10-06");
    expect(d.toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });

  it("rejects impossible dates", () => {
    expect(parseUTCMidnight("2026-02-30")).toBeNull();
    expect(parseUTCMidnight("2026-13-01")).toBeNull();
    expect(parseUTCMidnight("2026-10")).toBeNull();
  });
});

describe("month helpers", () => {
  it("derives month keys from UTC parts", () => {
    expect(monthKeyOf(new Date(Date.UTC(2026, 9, 6)))).toBe("2026-10");
  });

  it("computes month ranges", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("shifts across year boundaries", () => {
    expect(addMonthKeys("2026-01", -1)).toBe("2025-12");
    expect(addMonthKeys("2026-11", 2)).toBe("2027-01");
  });

  it("lists last n months oldest-first", () => {
    expect(lastNMonthKeys(3, "2026-10")).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("labels and measures months", () => {
    expect(monthKeyLabel("2026-10")).toBe("Oct 2026");
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("parseFlexibleDate", () => {
  it("accepts supported formats", () => {
    expect(parseFlexibleDate("2026-10-06")).toBe("2026-10-06");
    expect(parseFlexibleDate("06/10/2026")).toBe("2026-10-06"); // DD/MM (Indian)
    expect(parseFlexibleDate("6-10-2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("6 Oct 2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("06 October 2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("13/10/2026")).toBe("2026-10-13"); // day > 12
  });

  it("accepts the formats bank and spreadsheet exports actually produce", () => {
    expect(parseFlexibleDate("2026/10/06")).toBe("2026-10-06");
    expect(parseFlexibleDate("06.10.2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("6/10/26")).toBe("2026-10-06"); // two-digit year
    expect(parseFlexibleDate("06-October-2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("Oct 6, 2026")).toBe("2026-10-06");
    expect(parseFlexibleDate("6 Oct 26")).toBe("2026-10-06");
    expect(parseFlexibleDate("2026-10-06T00:00:00.000Z")).toBe("2026-10-06");
    expect(parseFlexibleDate("2026-10-06 14:30:00")).toBe("2026-10-06");
    expect(parseFlexibleDate("  06/10/2026  ")).toBe("2026-10-06");
    expect(parseFlexibleDate("| 06/10/2026 |")).toBe("2026-10-06");
  });

  it("reads the month first only when the day-first reading is impossible", () => {
    expect(parseFlexibleDate("13/10/2026")).toBe("2026-10-13");
    expect(parseFlexibleDate("10/13/2026")).toBe("2026-10-13"); // 13 cannot be a month
  });

  it("reads Excel/Sheets serial dates", () => {
    const serial = Math.round(
      (Date.parse("2026-10-06T00:00:00Z") - Date.UTC(1899, 11, 30)) / 86_400_000
    );
    expect(parseFlexibleDate(String(serial))).toBe("2026-10-06");
    expect(parseFlexibleDate("45123.75")).toBe("2023-07-16");
  });

  it("rejects invalid input", () => {
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("hello")).toBeNull();
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("13/13/2026")).toBeNull();
    expect(parseFlexibleDate("12/12/999")).toBeNull();
  });
});

describe("formatDayLabel", () => {
  it("formats without timezone shift", () => {
    expect(formatDayLabel(new Date(Date.UTC(2026, 9, 6)))).toBe("06 Oct 2026");
  });
});

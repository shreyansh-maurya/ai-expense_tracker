import { describe, expect, it } from "vitest";
import {
  formatINR,
  formatINRCompact,
  parseAmountToPaise,
  paiseToDecimalString,
} from "../src/lib/money";

describe("parseAmountToPaise", () => {
  it("parses common inputs", () => {
    expect(parseAmountToPaise("1234.56")).toBe(123456);
    expect(parseAmountToPaise("₹1,234.56")).toBe(123456);
    expect(parseAmountToPaise("1,23,456.78")).toBe(12345678);
    expect(parseAmountToPaise("1250")).toBe(125000);
    expect(parseAmountToPaise("1250.5")).toBe(125050);
    expect(parseAmountToPaise("0.99")).toBe(99);
    expect(parseAmountToPaise(" 42 ")).toBe(4200);
  });

  it("rejects invalid inputs", () => {
    expect(parseAmountToPaise("12.345")).toBeNull(); // >2 decimals
    expect(parseAmountToPaise("-5")).toBeNull();
    expect(parseAmountToPaise("abc")).toBeNull();
    expect(parseAmountToPaise("")).toBeNull();
    expect(parseAmountToPaise("1.2.3")).toBeNull();
    expect(parseAmountToPaise("20000001")).toBeNull(); // ₹2,00,00,001 — above int4 paise cap
  });

  it("accepts amounts up to the ₹2 crore int4-safe cap", () => {
    expect(parseAmountToPaise("20000000")).toBe(2_000_000_000);
    expect(parseAmountToPaise("19999999.99")).toBe(1_999_999_999);
  });
});

describe("paiseToDecimalString", () => {
  it("converts paise to decimal rupee strings", () => {
    expect(paiseToDecimalString(123456)).toBe("1234.56");
    expect(paiseToDecimalString(5)).toBe("0.05");
    expect(paiseToDecimalString(0)).toBe("0.00");
    expect(paiseToDecimalString(-250)).toBe("-2.50");
  });
});

describe("formatINR", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatINR(123456)).toBe("₹1,234.56");
    expect(formatINR(123456789)).toBe("₹12,34,567.89");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(-123456)).toBe("-₹1,234.56");
  });

  it("omits decimals on request", () => {
    expect(formatINR(100000, { decimals: false })).toBe("₹1,000");
    expect(formatINR(123456789, { decimals: false })).toBe("₹12,34,567");
  });
});

describe("formatINRCompact", () => {
  it("compacts large values for chart axes", () => {
    expect(formatINRCompact(150000)).toBe("₹1.5k"); // ₹1,500
    expect(formatINRCompact(12000000)).toBe("₹1.2L"); // ₹1,20,000
    expect(formatINRCompact(2000000000)).toBe("₹2Cr"); // ₹2,00,00,000
    expect(formatINRCompact(4500)).toBe("₹45");
  });
});

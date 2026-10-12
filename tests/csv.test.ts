import { describe, expect, it } from "vitest";
import {
  buildCsv,
  detectMapping,
  escapeCsvField,
  mapRow,
  normalizePaymentMethod,
  rowKey,
} from "../src/lib/csv/core";

describe("escapeCsvField", () => {
  it("leaves plain fields alone", () => {
    expect(escapeCsvField("plain")).toBe("plain");
  });

  it("quotes and doubles quotes per RFC 4180", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("buildCsv", () => {
  it("joins with CRLF and escapes", () => {
    const csv = buildCsv(["Date", "Notes"], [["2026-10-06", "a,b"]]);
    expect(csv).toBe('Date,Notes\r\n2026-10-06,"a,b"\r\n');
  });
});

describe("normalizePaymentMethod", () => {
  it("maps common descriptions", () => {
    expect(normalizePaymentMethod("UPI")).toBe("UPI");
    expect(normalizePaymentMethod("paid via gpay")).toBe("UPI");
    expect(normalizePaymentMethod("credit card")).toBe("CARD");
    expect(normalizePaymentMethod("Cash")).toBe("CASH");
    expect(normalizePaymentMethod("NEFT transfer")).toBe("NET_BANKING");
    expect(normalizePaymentMethod("Amazon Pay")).toBe("WALLET");
    expect(normalizePaymentMethod("")).toBe("OTHER");
    expect(normalizePaymentMethod("mystery")).toBe("OTHER");
  });
});

describe("detectMapping", () => {
  it("auto-detects common headers", () => {
    const m = detectMapping(["Date", "Merchant", "Amount", "Category", "Payment Mode", "Notes"]);
    expect(m).toEqual({
      date: "Date",
      merchant: "Merchant",
      amount: "Amount",
      category: "Category",
      paymentMethod: "Payment Mode",
      notes: "Notes",
    });
  });

  it("returns partial mapping for unknown headers", () => {
    const m = detectMapping(["a", "b"]);
    expect(m.date).toBeUndefined();
    expect(m.amount).toBeUndefined();
  });
});

describe("mapRow", () => {
  const mapping = {
    date: "Date",
    amount: "Amount",
    category: "Category",
    paymentMethod: "Mode",
    merchant: "Merchant",
    notes: "Notes",
  };
  const known = ["Food & Dining", "Other"];

  it("maps and validates a good row", () => {
    const row = mapRow(
      0,
      { Date: "06/10/2026", Amount: "₹250.50", Category: "food & dining", Mode: "upi", Merchant: "Swiggy", Notes: "lunch" },
      mapping,
      known
    );
    expect(row.dateISO).toBe("2026-10-06");
    expect(row.amountPaise).toBe(25050);
    expect(row.categoryName).toBe("Food & Dining"); // case-insensitive match to known name
    expect(row.paymentMethod).toBe("UPI");
    expect(row.merchant).toBe("Swiggy");
    expect(row.errors).toEqual([]);
  });

  it("flags bad rows and defaults category", () => {
    const row = mapRow(1, { Date: "bad", Amount: "-3", Category: "" }, mapping, known);
    expect(row.dateISO).toBeNull();
    expect(row.errors).toContain("Unrecognized date");
    expect(row.errors).toContain("Invalid amount");
    expect(row.categoryName).toBe("Other");
  });

  it("keeps unknown category names for the importer to create", () => {
    const row = mapRow(2, { Date: "2026-10-01", Amount: "10", Category: "New Thing" }, mapping, known);
    expect(row.categoryName).toBe("New Thing");
    expect(row.errors).toEqual([]);
  });
});

describe("rowKey", () => {
  it("builds stable duplicate-detection keys", () => {
    expect(rowKey("2026-10-06", 25050, "Swiggy")).toBe("2026-10-06|25050|swiggy");
  });
});

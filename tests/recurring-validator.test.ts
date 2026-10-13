import { describe, expect, it } from "vitest";
import { recurringInputSchema } from "../src/lib/validators/recurring";

/** What the expense dialog actually sends: strings, optional blanks included. */
const valid = {
  amount: "250.50",
  categoryId: "cat_1",
  paymentMethod: "UPI",
  frequency: "MONTHLY",
  interval: "1",
  startDate: "2026-10-13",
  endDate: "",
  merchant: "Netflix",
  notes: "",
};

const firstError = (input: unknown) => {
  const r = recurringInputSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]!.message;
};

describe("recurringInputSchema", () => {
  it("accepts a valid monthly template and normalizes blanks", () => {
    const r = recurringInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.endDate).toBeUndefined(); // "" → omitted
    expect(r.data.interval).toBe(1); // string → number
    expect(r.data.merchant).toBe("Netflix");
  });

  it("coerces the interval and enforces its bounds", () => {
    expect(recurringInputSchema.safeParse({ ...valid, interval: "3" }).success).toBe(true);
    expect(firstError({ ...valid, interval: "" })).toBe("Choose how often it repeats");
    expect(firstError({ ...valid, interval: "0" })).toBe("Repeat interval must be at least 1");
    expect(firstError({ ...valid, interval: "53" })).toBe("Repeat interval must be 52 or less");
    expect(firstError({ ...valid, interval: "1.5" })).toBe("Repeat interval must be a whole number");
  });

  it("rejects an unknown frequency with a friendly message", () => {
    expect(firstError({ ...valid, frequency: "DAILY" })).toBe("Choose how often it repeats");
    expect(firstError({ ...valid, frequency: undefined })).toBe("Choose how often it repeats");
  });

  it("rejects an end date before the start date", () => {
    expect(firstError({ ...valid, endDate: "2026-10-12" })).toBe(
      "End date must be on or after the start date"
    );
    expect(recurringInputSchema.safeParse({ ...valid, endDate: "2026-10-13" }).success).toBe(true);
  });

  it("guards against a typo-level start date", () => {
    expect(firstError({ ...valid, startDate: "1999-12-31" })).toBe(
      "Start date must be on or after 1 Jan 2000"
    );
    expect(firstError({ ...valid, startDate: "2026-02-30" })).toBe("Choose a valid date");
  });

  it("rejects bad amounts and missing categories like the expense form does", () => {
    expect(firstError({ ...valid, amount: "" })).toBe("Amount is required");
    // Negative signs never parse, so the format refine fires first…
    expect(firstError({ ...valid, amount: "-5" })).toBe("Enter a valid amount, e.g. 1,250.50");
    // …while a parsed-but-zero amount reaches the positivity refine.
    expect(firstError({ ...valid, amount: "0" })).toBe("Amount must be greater than zero");
    expect(firstError({ ...valid, categoryId: "" })).toBe("Choose a category");
    expect(firstError({ ...valid, paymentMethod: "BITCOIN" })).toBeDefined();
  });
});

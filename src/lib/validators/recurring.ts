import { z } from "zod";
import { parseUTCMidnight } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/csv/core";
import { RECURRING_FREQUENCIES } from "@/lib/recurring-schedule";
import { amountString, isoDate } from "./expense";

export { RECURRING_FREQUENCIES };
export type { RecurringFrequency } from "@/lib/recurring-schedule";

const emptyToUndef = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v;

/** Earliest start date we allow — guards against a typo backfilling decades of rows. */
const MIN_START = "2000-01-01";

export const recurringInputSchema = z
  .object({
    amount: amountString,
    categoryId: z.string().min(1, "Choose a category"),
    paymentMethod: z.enum(PAYMENT_METHODS),
    frequency: z.enum(RECURRING_FREQUENCIES, { errorMap: () => ({ message: "Choose how often it repeats" }) }),
    interval: z.preprocess(
      emptyToUndef,
      z.coerce
        .number({ invalid_type_error: "Choose how often it repeats" })
        .int("Repeat interval must be a whole number")
        .min(1, "Repeat interval must be at least 1")
        .max(52, "Repeat interval must be 52 or less")
    ),
    startDate: isoDate,
    endDate: z.preprocess(emptyToUndef, isoDate.optional()),
    merchant: z.string().trim().max(120).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
  })
  // NOTE: zod runs these callbacks even when the object parse above is dirty
  // (e.g. a malformed date that already failed `isoDate`), so they must be
  // null-safe — a `!`-cast here would crash the server action on bad input.
  .refine((v) => {
    const start = parseUTCMidnight(v.startDate);
    return start !== null && start.getTime() >= parseUTCMidnight(MIN_START)!.getTime();
  }, {
    message: "Start date must be on or after 1 Jan 2000",
    path: ["startDate"],
  })
  .refine((v) => {
    if (!v.endDate) return true;
    const start = parseUTCMidnight(v.startDate);
    const end = parseUTCMidnight(v.endDate);
    return start !== null && end !== null && end.getTime() >= start.getTime();
  }, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type RecurringInput = z.infer<typeof recurringInputSchema>;

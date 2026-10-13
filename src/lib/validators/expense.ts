import { z } from "zod";
import { parseFlexibleDate, parseUTCMidnight } from "@/lib/dates";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/csv/core";
import { parseAmountToPaise } from "@/lib/money";

export { PAYMENT_METHODS };
export type { PaymentMethod };

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  OTHER: "Other",
};

export const amountString = z
  .string()
  .min(1, "Amount is required")
  .refine((v) => parseAmountToPaise(v) !== null, "Enter a valid amount, e.g. 1,250.50")
  .refine((v) => (parseAmountToPaise(v) ?? 0) > 0, "Amount must be greater than zero");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
  .refine((v) => parseUTCMidnight(v) !== null, "Choose a valid date");

export const expenseInputSchema = z.object({
  amount: amountString,
  date: isoDate,
  categoryId: z.string().min(1, "Choose a category"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  merchant: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

const emptyToUndef = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") ? undefined : v;

/** Lenient URL filter schema — invalid values degrade to "no filter". */
export const expenseFilterSchema = z.object({
  q: z.preprocess(emptyToUndef, z.string().trim().max(120).optional().catch(undefined)),
  category: z.preprocess(emptyToUndef, z.string().optional().catch(undefined)),
  method: z.preprocess(emptyToUndef, z.enum(PAYMENT_METHODS).optional().catch(undefined)),
  from: z.preprocess(emptyToUndef, isoDate.optional().catch(undefined)),
  to: z.preprocess(emptyToUndef, isoDate.optional().catch(undefined)),
  min: z.preprocess(emptyToUndef, z.string().optional().catch(undefined)),
  max: z.preprocess(emptyToUndef, z.string().optional().catch(undefined)),
  page: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(100000).catch(1)),
});
export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;

/** Re-export for import wizard date validation (day-first Indian formats). */
export { parseFlexibleDate };

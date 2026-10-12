import { z } from "zod";
import { parseAmountToPaise } from "@/lib/money";

const amountString = z
  .string()
  .min(1, "Limit is required")
  .refine((v) => parseAmountToPaise(v) !== null, "Enter a valid amount, e.g. 5,000")
  .refine((v) => (parseAmountToPaise(v) ?? 0) > 0, "Limit must be greater than zero");

export const budgetInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month"),
  categoryId: z.string().default(""), // "" = overall monthly budget
  limit: amountString,
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

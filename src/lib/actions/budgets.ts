"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import { budgetInputSchema } from "@/lib/validators/budget";
import { deleteBudget, upsertBudget } from "@/lib/services/budgets";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

export async function saveBudgetAction(input: unknown): Promise<ActionResult> {
  const parsed = budgetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  try {
    await upsertBudget({
      categoryId: parsed.data.categoryId || null,
      month: parsed.data.month,
      limitPaise: parseAmountToPaise(parsed.data.limit)!,
    });
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidatePath("/");
  revalidatePath("/budgets");
  return { ok: true };
}

export async function deleteBudgetAction(id: string): Promise<ActionResult> {
  try {
    await deleteBudget(id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidatePath("/");
  revalidatePath("/budgets");
  return { ok: true };
}

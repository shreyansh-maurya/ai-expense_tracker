"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import { expenseInputSchema } from "@/lib/validators/expense";
import { createExpense, deleteExpense, updateExpense } from "@/lib/services/expenses";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
}

export async function saveExpenseAction(input: unknown, id?: string): Promise<ActionResult> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    const data = {
      amountPaise: parseAmountToPaise(d.amount)!,
      dateISO: d.date,
      categoryId: d.categoryId,
      paymentMethod: d.paymentMethod,
      merchant: d.merchant || undefined,
      notes: d.notes || undefined,
    };
    if (id) await updateExpense(id, data);
    else await createExpense(data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    await deleteExpense(id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

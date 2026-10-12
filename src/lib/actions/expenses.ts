"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import { expenseInputSchema } from "@/lib/validators/expense";
import { createExpense, deleteExpense, updateExpense } from "@/lib/services/expenses";
import { prisma } from "@/lib/db";
import { suggestCategoriesBatch } from "@/lib/services/ai-categorize";
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

export type SuggestCategoryResponse =
  | { ok: true; categoryName: string | null; source: "RULE" | "AI" | null }
  | { ok: false; error: string };

/**
 * Phase B: suggest a category for merchant/notes text the user is typing.
 * Keyword rules first; AI only when configured and only if rules miss.
 * Pure preview — never writes anything.
 */
export async function suggestCategoryAction(
  merchant: string,
  notes: string
): Promise<SuggestCategoryResponse> {
  try {
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, keywords: true, isArchived: true },
    });
    const [s] = await suggestCategoriesBatch(
      [{ merchant, notes }],
      categories
    );
    if (!s) return { ok: true, categoryName: null, source: null };
    return { ok: true, categoryName: s.categoryName, source: s.source };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
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

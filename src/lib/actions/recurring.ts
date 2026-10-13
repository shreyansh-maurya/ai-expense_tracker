"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import { recurringInputSchema } from "@/lib/validators/recurring";
import {
  createRecurring,
  deleteRecurring,
  runDueRecurring,
  setRecurringActive,
  skipNextOccurrence,
  updateRecurring,
} from "@/lib/services/recurring";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
  revalidatePath("/recurring");
}

export type SaveRecurringResponse = { ok: true; created: number } | { ok: false; error: string };

/**
 * Create or update a recurring template, then materialize anything already
 * due — so a template starting today immediately shows up as an expense.
 */
export async function saveRecurringAction(
  input: unknown,
  id?: string
): Promise<SaveRecurringResponse> {
  const parsed = recurringInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    const data = {
      amountPaise: parseAmountToPaise(d.amount)!,
      categoryId: d.categoryId,
      paymentMethod: d.paymentMethod,
      frequency: d.frequency,
      interval: d.interval,
      startDateISO: d.startDate,
      endDateISO: d.endDate,
      merchant: d.merchant || undefined,
      notes: d.notes || undefined,
    };
    if (id) await updateRecurring(id, data);
    else await createRecurring(data);
    const { created } = await runDueRecurring();
    revalidateAll();
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

export async function toggleRecurringAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setRecurringActive(id, active);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export type SkipRecurringResponse =
  | { ok: true; nextISO: string | null }
  | { ok: false; error: string };

export async function skipRecurringAction(id: string): Promise<SkipRecurringResponse> {
  try {
    const nextISO = await skipNextOccurrence(id);
    // Skipping may leave the schedule past its end date — settle it now.
    await runDueRecurring();
    revalidateAll();
    return { ok: true, nextISO };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

export async function deleteRecurringAction(id: string): Promise<ActionResult> {
  try {
    await deleteRecurring(id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

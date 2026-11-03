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
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser();
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
    if (id) await updateRecurring(user.id, id, data);
    else await createRecurring(user.id, data);
    const { created } = await runDueRecurring(user.id);
    revalidateAll();
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

export async function toggleRecurringAction(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await setRecurringActive(user.id, id, active);
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
  const user = await requireUser();
  try {
    const nextISO = await skipNextOccurrence(user.id, id);
    // Skipping may leave the schedule past its end date — settle it now.
    await runDueRecurring(user.id);
    revalidateAll();
    return { ok: true, nextISO };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

export async function deleteRecurringAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deleteRecurring(user.id, id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

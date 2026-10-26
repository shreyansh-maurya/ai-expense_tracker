"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import {
  boughtExpenseSchema,
  wishlistInputSchema,
  wishlistStatusSchema,
} from "@/lib/validators/wishlist";
import {
  createWishlistItem,
  deleteWishlistItem,
  logWishlistBought,
  setWishlistStatus,
  updateWishlistItem,
} from "@/lib/services/wishlist";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/wishlist");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
}

export async function saveWishlistAction(input: unknown, id?: string): Promise<ActionResult> {
  const parsed = wishlistInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    const data = {
      title: d.title,
      url: d.url,
      store: d.store,
      imageUrl: d.imageUrl,
      pricePaise: d.price ? (parseAmountToPaise(d.price) ?? undefined) : undefined,
      priority: d.priority,
      notes: d.notes || undefined,
    };
    if (id) await updateWishlistItem(id, data);
    else await createWishlistItem(data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function setWishlistStatusAction(id: string, status: string): Promise<ActionResult> {
  const parsed = wishlistStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  try {
    await setWishlistStatus(id, parsed.data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function logBoughtAction(
  id: string,
  input: unknown
): Promise<{ ok: true; expenseId: string } | { ok: false; error: string }> {
  const parsed = boughtExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    const expense = await logWishlistBought(id, {
      amountPaise: parseAmountToPaise(d.amount)!,
      dateISO: d.date,
      categoryId: d.categoryId,
      paymentMethod: d.paymentMethod,
      merchant: d.merchant || undefined,
      notes: d.notes || undefined,
    });
    revalidateAll();
    return { ok: true, expenseId: expense.id };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

export async function deleteWishlistAction(id: string): Promise<ActionResult> {
  try {
    await deleteWishlistItem(id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { parseAmountToPaise } from "@/lib/money";
import {
  boughtExpenseSchema,
  wishlistInputSchema,
  wishlistPriceQuoteSchema,
  wishlistStatusSchema,
} from "@/lib/validators/wishlist";
import {
  createWishlistItem,
  deleteWishlistItem,
  listWishlist,
  logWishlistBought,
  setWishlistStatus,
  updateWishlistItem,
} from "@/lib/services/wishlist";
import { deletePriceQuote, upsertPriceQuote } from "@/lib/services/wishlist-prices";
import { fetchPriceForItem } from "@/lib/services/price-fetch";
import { requireUser } from "@/lib/auth";
import { ActionResult, toErrorMessage, zodFirstError } from "./helpers";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/wishlist");
  revalidatePath("/expenses");
  revalidatePath("/budgets");
}

export async function saveWishlistAction(input: unknown, id?: string): Promise<ActionResult> {
  const user = await requireUser();
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
    if (id) await updateWishlistItem(user.id, id, data);
    else await createWishlistItem(user.id, data);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

export async function setWishlistStatusAction(id: string, status: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = wishlistStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  try {
    await setWishlistStatus(user.id, id, parsed.data);
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
  const user = await requireUser();
  const parsed = boughtExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    const expense = await logWishlistBought(user.id, id, {
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
  const user = await requireUser();
  try {
    await deleteWishlistItem(user.id, id);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidateAll();
  return { ok: true };
}

/** Record/update the price seen at one store for a wishlist item (compare feature). */
export async function savePriceQuoteAction(
  itemId: string,
  input: unknown
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = wishlistPriceQuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodFirstError(parsed.error) };
  const d = parsed.data;
  try {
    await upsertPriceQuote(user.id, itemId, {
      store: d.store,
      pricePaise: parseAmountToPaise(d.price)!,
      url: d.url,
    });
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidatePath("/wishlist");
  revalidatePath("/");
  return { ok: true };
}

export type PriceRefreshResult =
  | { ok: true; checked: number; updated: number; failures: { title: string; error: string }[] }
  | { ok: false; error: string };

/** how many product links one click checks — keeps the action inside a function timeout */
const MAX_PRICE_CHECKS = 6;

/**
 * Fetch the live price for every wishlist product link (WANTED/ORDERED only) and
 * record it as that store's quote. Prices come back as append-only history, so a
 * refresh also updates the trend and the all-time low.
 */
export async function refreshWishlistPricesAction(): Promise<PriceRefreshResult> {
  const user = await requireUser();
  const rows = await listWishlist(user.id);
  const targets = rows
    .filter((r) => r.url && (r.status === "WANTED" || r.status === "ORDERED"))
    .slice(0, MAX_PRICE_CHECKS);

  if (targets.length === 0) {
    return { ok: false, error: "Add a product link to a wishlist item first — nothing to check." };
  }

  const settled = await Promise.allSettled(
    targets.map(async (item) => {
      const found = await fetchPriceForItem(item.url!, item.store as never);
      await upsertPriceQuote(user.id, item.id, {
        store: found.store,
        pricePaise: found.pricePaise,
        url: item.url!,
      });
    })
  );

  const failures: { title: string; error: string }[] = [];
  let updated = 0;
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") updated += 1;
    else failures.push({ title: targets[i].title, error: toErrorMessage(result.reason) });
  });

  if (updated > 0) {
    revalidatePath("/wishlist");
    revalidatePath("/");
  }
  return { ok: true, checked: targets.length, updated, failures };
}

export async function deletePriceQuoteAction(quoteId: string): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await deletePriceQuote(user.id, quoteId);
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
  revalidatePath("/wishlist");
  revalidatePath("/");
  return { ok: true };
}

import { prisma } from "@/lib/db";
import { parseUTCMidnight } from "@/lib/dates";
import type { PaymentMethod } from "@/lib/validators/expense";
import {
  detectStoreFromUrl,
  type WishlistPriority,
  type WishlistStatus,
  type WishlistStore,
} from "@/lib/validators/wishlist";
import { createExpense } from "./expenses";
import { ServiceError } from "./errors";

export type WishlistRow = {
  id: string;
  title: string;
  url: string | null;
  store: string;
  imageUrl: string | null;
  pricePaise: number | null;
  priority: string;
  status: string;
  notes: string | null;
  expenseId: string | null;
  createdAt: Date;
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_ORDER: Record<string, number> = { WANTED: 0, ORDERED: 1, BOUGHT: 2, DROPPED: 3 };

export async function listWishlist(): Promise<WishlistRow[]> {
  const rows = await prisma.wishlistItem.findMany();
  return rows.sort((a, b) => {
    const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (s !== 0) return s;
    const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (p !== 0) return p;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export type WishlistWriteInput = {
  title: string;
  url?: string;
  store?: WishlistStore;
  imageUrl?: string;
  pricePaise?: number;
  priority?: WishlistPriority;
  notes?: string;
};

/** Resolve the store: explicit choice wins; otherwise detect from the URL; else OTHER. */
function resolveStore(url: string | undefined, store: WishlistStore | undefined): WishlistStore {
  if (store) return store;
  return detectStoreFromUrl(url) ?? "OTHER";
}

export async function createWishlistItem(input: WishlistWriteInput) {
  const url = input.url?.trim() || undefined;
  if (url) {
    // Same product pasted twice is almost always an accident — catch it early.
    const dupe = await prisma.wishlistItem.findFirst({ where: { url } });
    if (dupe) {
      throw new ServiceError(
        `This link is already on your wishlist ("${dupe.title}") — open it from there instead.`
      );
    }
  }
  return prisma.wishlistItem.create({
    data: {
      title: input.title,
      url: url ?? null,
      store: resolveStore(url, input.store),
      imageUrl: input.imageUrl?.trim() || null,
      pricePaise: input.pricePaise ?? null,
      priority: input.priority ?? "MEDIUM",
      notes: input.notes?.trim() || null,
    },
  });
}

export async function updateWishlistItem(id: string, input: WishlistWriteInput) {
  const existing = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Wishlist item not found");

  const url = input.url?.trim() || undefined;
  if (url !== existing.url && url) {
    const dupe = await prisma.wishlistItem.findFirst({ where: { url, id: { not: id } } });
    if (dupe) {
      throw new ServiceError(`Another wishlist item already uses this link ("${dupe.title}")`);
    }
  }
  return prisma.wishlistItem.update({
    where: { id },
    data: {
      title: input.title,
      url: url ?? null,
      // only re-detect when the URL actually changed and no explicit store was chosen
      store: input.store ?? (url !== existing.url ? resolveStore(url, undefined) : existing.store),
      imageUrl: input.imageUrl?.trim() || null,
      pricePaise: input.pricePaise ?? null,
      priority: input.priority ?? "MEDIUM",
      notes: input.notes?.trim() || null,
    },
  });
}

export async function setWishlistStatus(id: string, status: WishlistStatus) {
  const existing = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Wishlist item not found");
  return prisma.wishlistItem.update({ where: { id }, data: { status } });
}

export type BoughtInput = {
  amountPaise: number;
  dateISO: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  notes?: string;
};

/**
 * "Mark bought" done properly: creates a real expense (same validation path
 * as the expenses page) and links it back to the wishlist item.
 */
export async function logWishlistBought(id: string, input: BoughtInput) {
  const item = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!item) throw new ServiceError("Wishlist item not found");
  if (item.expenseId) {
    throw new ServiceError("This item was already logged as an expense");
  }
  const date = parseUTCMidnight(input.dateISO);
  if (!date) throw new ServiceError("Invalid date");

  const expense = await createExpense({
    amountPaise: input.amountPaise,
    dateISO: input.dateISO,
    categoryId: input.categoryId,
    paymentMethod: input.paymentMethod,
    merchant: input.merchant || item.title,
    notes: input.notes || `From wishlist: ${item.title}`,
  });

  await prisma.wishlistItem.update({
    where: { id },
    data: { status: "BOUGHT", expenseId: expense.id, pricePaise: input.amountPaise },
  });
  return expense;
}

export async function deleteWishlistItem(id: string) {
  const existing = await prisma.wishlistItem.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Wishlist item not found");
  // the linked expense is intentional spend history — it stays
  await prisma.wishlistItem.delete({ where: { id } });
}

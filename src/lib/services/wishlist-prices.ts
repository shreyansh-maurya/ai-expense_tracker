import { prisma } from "@/lib/db";
import type { WishlistStore } from "@/lib/validators/wishlist";
import { ServiceError } from "./errors";

export type PriceQuoteRow = {
  id: string;
  wishlistItemId: string;
  store: string;
  pricePaise: number;
  url: string | null;
  updatedAt: Date;
};

export type QuoteWriteInput = {
  store: WishlistStore;
  pricePaise: number;
  url?: string;
};

/**
 * All tracked prices grouped by wishlist item id (most recently checked first).
 * One query for the whole page — the group feeds each item's compare dialog.
 */
export async function listAllPriceQuotes(): Promise<Record<string, PriceQuoteRow[]>> {
  const quotes = await prisma.wishlistPriceQuote.findMany({ orderBy: { updatedAt: "desc" } });
  const byItem: Record<string, PriceQuoteRow[]> = {};
  for (const q of quotes) {
    (byItem[q.wishlistItemId] ??= []).push({
      id: q.id,
      wishlistItemId: q.wishlistItemId,
      store: q.store,
      pricePaise: q.pricePaise,
      url: q.url,
      updatedAt: q.updatedAt,
    });
  }
  return byItem;
}

/**
 * Record/update the current price of an item at one store. The (item, store)
 * unique pair means "re-checking a store" updates the price — Flash-style:
 * one tracked price per store, always current.
 */
export async function upsertPriceQuote(wishlistItemId: string, input: QuoteWriteInput) {
  const item = await prisma.wishlistItem.findUnique({ where: { id: wishlistItemId } });
  if (!item) throw new ServiceError("Wishlist item not found");
  return prisma.wishlistPriceQuote.upsert({
    where: {
      wishlistItemId_store: { wishlistItemId, store: input.store },
    },
    create: {
      wishlistItemId,
      store: input.store,
      pricePaise: input.pricePaise,
      url: input.url?.trim() || null,
    },
    update: {
      pricePaise: input.pricePaise,
      url: input.url?.trim() || null,
    },
  });
}

export async function deletePriceQuote(quoteId: string) {
  const existing = await prisma.wishlistPriceQuote.findUnique({ where: { id: quoteId } });
  if (!existing) throw new ServiceError("Price quote not found");
  await prisma.wishlistPriceQuote.delete({ where: { id: quoteId } });
}

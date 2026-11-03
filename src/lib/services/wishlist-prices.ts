import { prisma } from "@/lib/db";
import type { WishlistStore } from "@/lib/validators/wishlist";
import type { PricePoint } from "@/lib/wishlist-prices";
import { ServiceError } from "./errors";

export type PriceQuoteRow = {
  id: string;
  wishlistItemId: string;
  store: string;
  pricePaise: number;
  url: string | null;
  updatedAt: Date;
};

export type PriceHistoryRow = PricePoint;

export type QuoteWriteInput = {
  store: WishlistStore;
  pricePaise: number;
  url?: string;
};

/**
 * All tracked prices grouped by wishlist item id (most recently checked first).
 * One query for the whole page — the group feeds each item's compare dialog.
 */
export async function listAllPriceQuotes(userId: string): Promise<Record<string, PriceQuoteRow[]>> {
  const quotes = await prisma.wishlistPriceQuote.findMany({
    where: { item: { userId } },
    orderBy: { updatedAt: "desc" },
  });
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
 * Append-only price history grouped by wishlist item id, oldest first. One query
 * for the whole page; the dialog derives per-store trends and the all-time low.
 */
export async function listAllPriceHistory(userId: string): Promise<Record<string, PriceHistoryRow[]>> {
  const rows = await prisma.wishlistPriceSnapshot.findMany({
    where: { item: { userId } },
    orderBy: { recordedAt: "asc" },
  });
  const byItem: Record<string, PriceHistoryRow[]> = {};
  for (const r of rows) {
    (byItem[r.wishlistItemId] ??= []).push({
      store: r.store,
      pricePaise: r.pricePaise,
      recordedAt: r.recordedAt,
    });
  }
  return byItem;
}

/**
 * Record/update the current price of an item at one store. The (item, store)
 * unique pair means "re-checking a store" updates the price — Flash-style:
 * one tracked price per store, always current — while every observed change is
 * appended to WishlistPriceSnapshot so the trend survives the overwrite.
 */
export async function upsertPriceQuote(
  userId: string,
  wishlistItemId: string,
  input: QuoteWriteInput
) {
  const item = await prisma.wishlistItem.findFirst({ where: { id: wishlistItemId, userId } });
  if (!item) throw new ServiceError("Wishlist item not found");

  const url = input.url?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.wishlistPriceQuote.findUnique({
      where: { wishlistItemId_store: { wishlistItemId, store: input.store } },
    });
    const lastSnapshot = await tx.wishlistPriceSnapshot.findFirst({
      where: { wishlistItemId, store: input.store },
      orderBy: { recordedAt: "desc" },
    });

    if (!lastSnapshot) {
      // First history for this store: seed the price being replaced (if any) so
      // quotes recorded before history existed still show a real trend.
      if (existing && existing.pricePaise !== input.pricePaise) {
        await tx.wishlistPriceSnapshot.create({
          data: {
            wishlistItemId,
            store: input.store,
            pricePaise: existing.pricePaise,
            recordedAt: existing.updatedAt,
          },
        });
      }
      await tx.wishlistPriceSnapshot.create({
        data: { wishlistItemId, store: input.store, pricePaise: input.pricePaise },
      });
    } else if (lastSnapshot.pricePaise !== input.pricePaise) {
      await tx.wishlistPriceSnapshot.create({
        data: { wishlistItemId, store: input.store, pricePaise: input.pricePaise },
      });
    }

    return tx.wishlistPriceQuote.upsert({
      where: {
        wishlistItemId_store: { wishlistItemId, store: input.store },
      },
      create: {
        wishlistItemId,
        store: input.store,
        pricePaise: input.pricePaise,
        url,
      },
      update: {
        pricePaise: input.pricePaise,
        // The inline price form no longer collects a link — keep any saved one.
        ...(url ? { url } : {}),
      },
    });
  });
}

/** Stop tracking a store for an item — its current price and its history go together. */
export async function deletePriceQuote(userId: string, quoteId: string) {
  const existing = await prisma.wishlistPriceQuote.findFirst({
    where: { id: quoteId, item: { userId } },
  });
  if (!existing) throw new ServiceError("Price quote not found");
  await prisma.$transaction([
    prisma.wishlistPriceSnapshot.deleteMany({
      where: { wishlistItemId: existing.wishlistItemId, store: existing.store },
    }),
    prisma.wishlistPriceQuote.delete({ where: { id: quoteId } }),
  ]);
}

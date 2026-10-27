/**
 * Pure price-comparison helpers for the wishlist feature — no prisma, no react,
 * so they run in services, server components and tests alike.
 *
 * The wishlist cannot scrape Amazon/Flipkart etc. (no public price APIs), so
 * comparison works the first-party way: the user records the price they saw at
 * each store as a "quote", and these helpers turn an item's quotes into a
 * Flash-style best-price comparison.
 */
import { WISHLIST_STORES, type WishlistStore } from "@/lib/wishlist-stores";

export type PriceQuoteLike = {
  id: string;
  store: string;
  pricePaise: number;
  url: string | null;
  checkedAt?: Date; // only the compare dialog displays freshness — not needed by these helpers
};

const STORE_SEARCH_PATHS: Partial<Record<WishlistStore, string>> = {
  AMAZON: "https://www.amazon.in/s?k=",
  FLIPKART: "https://www.flipkart.com/search?q=",
  MYNTRA: "https://www.myntra.com/?rawQuery=",
  AJIO: "https://www.ajio.com/search/?text=",
  MEESHO: "https://www.meesho.com/search?q=",
  CROMA: "https://www.croma.com/searchB?q=",
  NYKAA: "https://www.nykaa.com/search/result/?q=",
  TATA_CLIQ: "https://www.tatacliq.com/search/?searchCategory=all&text=",
};

/**
 * A store search URL for the item's title — the "go check the price there" link
 * for stores that don't have a recorded price yet. OTHER has no site to search.
 */
export function storeSearchUrl(store: string, title: string): string | null {
  const base = STORE_SEARCH_PATHS[store as WishlistStore];
  const q = title.trim();
  if (!base || !q) return null;
  return `${base}${encodeURIComponent(q)}`;
}

/** Stores one can still check prices at: all registered stores minus already-quoted ones (OTHER never has a site to check). */
export function checkableStores(quotedStores: string[]): WishlistStore[] {
  const quoted = new Set(quotedStores);
  return WISHLIST_STORES.filter((s) => s !== "OTHER" && !quoted.has(s));
}

export type QuotesSummary = {
  count: number;
  best: PriceQuoteLike;
  highest: PriceQuoteLike | null;
  savingsPaise: number;
  savingsPct: number;
};

/**
 * Best-price summary of an item's quotes: cheapest store, most expensive store,
 * and how much you save by buying at the cheapest. Ties break alphabetically so
 * the result is stable. Returns null when there are no usable quotes.
 */
export function summarizeQuotes(quotes: PriceQuoteLike[]): QuotesSummary | null {
  const sorted = quotes
    .filter((q) => q.pricePaise > 0)
    .sort((a, b) => a.pricePaise - b.pricePaise || a.store.localeCompare(b.store));
  if (sorted.length === 0) return null;

  const best = sorted[0];
  const highest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const savingsPaise = highest ? highest.pricePaise - best.pricePaise : 0;
  const savingsPct =
    highest && highest.pricePaise > 0 ? Math.round((savingsPaise / highest.pricePaise) * 100) : 0;

  return { count: sorted.length, best, highest, savingsPaise, savingsPct };
}

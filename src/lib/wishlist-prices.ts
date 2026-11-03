/**
 * Pure price-comparison helpers for the wishlist feature — no prisma, no react,
 * so they run in services, server components and tests alike.
 *
 * The wishlist cannot scrape Amazon/Flipkart etc. (no public price APIs), so
 * comparison works the first-party way: the user records the price they saw at
 * each store as a "quote", and these helpers turn an item's quotes into a
 * Flash-style best-price comparison.
 *
 * Quotes are the current price per store; PricePoints are the append-only
 * history of observed prices, which is what trends and all-time lows need.
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

/** One historical price reading of an item at a store (append-only). */
export type PricePoint = {
  store: string;
  pricePaise: number;
  recordedAt: Date;
};

export type PriceTrend = {
  store: string;
  samples: number;
  firstPaise: number;
  lastPaise: number;
  /** last - first: negative means the price dropped since tracking started */
  deltaPaise: number;
  /** rounded magnitude of the change, as a percentage of the first reading */
  deltaPct: number;
  direction: "down" | "up" | "flat";
  lowestPaise: number;
  /** the latest reading is the cheapest ever recorded for this store */
  isAllTimeLow: boolean;
};

/** Usable readings, oldest first; zero/negative prices are noise and dropped. */
function chronological(points: PricePoint[]): PricePoint[] {
  return points
    .filter((p) => p.pricePaise > 0)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || a.pricePaise - b.pricePaise);
}

/**
 * Trend across readings — pass one store's history for a per-store trend, or an
 * item's whole history for the item's overall movement. Needs at least two
 * readings: a single price is not a trend.
 */
export function summarizeTrend(points: PricePoint[]): PriceTrend | null {
  const ordered = chronological(points);
  if (ordered.length < 2) return null;

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const deltaPaise = last.pricePaise - first.pricePaise;
  const lowestPaise = Math.min(...ordered.map((p) => p.pricePaise));

  return {
    store: last.store,
    samples: ordered.length,
    firstPaise: first.pricePaise,
    lastPaise: last.pricePaise,
    deltaPaise,
    deltaPct: Math.round((Math.abs(deltaPaise) / first.pricePaise) * 100),
    direction: deltaPaise < 0 ? "down" : deltaPaise > 0 ? "up" : "flat",
    lowestPaise,
    isAllTimeLow: last.pricePaise === lowestPaise,
  };
}

export type LowestEver = { store: string; pricePaise: number; recordedAt: Date };

/**
 * Cheapest price ever recorded for an item, across every store. Ties keep the
 * earliest sighting so the label is stable. Null when there is no usable history.
 */
export function lowestEverPrice(points: PricePoint[]): LowestEver | null {
  const ordered = chronological(points);
  if (ordered.length === 0) return null;
  return ordered.reduce((best, p) => (p.pricePaise < best.pricePaise ? p : best));
}

/** True when the current best price is also the cheapest ever seen (needs real history). */
export function isAtAllTimeLow(bestPaise: number, history: PricePoint[]): boolean {
  const lowest = lowestEverPrice(history);
  return lowest != null && history.filter((p) => p.pricePaise > 0).length >= 2
    ? lowest.pricePaise === bestPaise
    : false;
}

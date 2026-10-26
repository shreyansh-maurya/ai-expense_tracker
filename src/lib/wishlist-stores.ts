/**
 * Wishlist store registry — the pure, dependency-free half of the wishlist
 * feature. Detection is hostname-based so the same helper works in the client
 * (instant feedback while pasting a link) and the server (authoritative).
 */

export const WISHLIST_STORES = [
  "AMAZON",
  "FLIPKART",
  "MYNTRA",
  "AJIO",
  "MEESHO",
  "CROMA",
  "NYKAA",
  "TATA_CLIQ",
  "OTHER",
] as const;

export type WishlistStore = (typeof WISHLIST_STORES)[number];

export const WISHLIST_STORE_LABELS: Record<WishlistStore, string> = {
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  MYNTRA: "Myntra",
  AJIO: "AJIO",
  MEESHO: "Meesho",
  CROMA: "Croma",
  NYKAA: "Nykaa",
  TATA_CLIQ: "Tata CLiQ",
  OTHER: "Other",
};

/** hostnames (suffix match on dot-boundary) that map to each store */
const STORE_HOST_PATTERNS: Array<[WishlistStore, string[]]> = [
  ["AMAZON", ["amazon", "amzn.to", "amzn.eu"]],
  ["FLIPKART", ["flipkart", "fkrt.it"]],
  ["MYNTRA", ["myntra"]],
  ["AJIO", ["ajio", "ajiolite"]],
  ["MEESHO", ["meesho"]],
  ["CROMA", ["croma"]],
  ["NYKAA", ["nykaa"]],
  ["TATA_CLIQ", ["tatacliq"]],
];

/**
 * Detect the store from a pasted product URL.
 * Returns null when the URL isn't a recognizable store link (caller decides:
 * keep typed store, or fall back to OTHER).
 */
export function detectStoreFromUrl(rawUrl: string | null | undefined): WishlistStore | null {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return null;
  let host: string | null = null;
  try {
    // tolerate links pasted without a scheme ("www.amazon.in/dp/B0…")
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [store, patterns] of STORE_HOST_PATTERNS) {
    for (const p of patterns) {
      // dot-boundary match: amazon.in, www.amazon.co.in and amazon.com all hit,
      // while "notamazon.example.com" does not
      if (host === p || host.endsWith(`.${p}`) || host.split(".").includes(p)) return store;
    }
  }
  return null;
}

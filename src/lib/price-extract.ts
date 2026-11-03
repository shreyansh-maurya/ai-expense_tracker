/**
 * Pure price extraction from a store product page's HTML — no network, no prisma.
 *
 * Stores have no public price APIs, so the fetch flow reads the product page and
 * pulls the price out of the structured data the page already publishes:
 * JSON-LD first (schema.org Offer), then price meta tags, then the store-specific
 * markup patterns. Everything here is deterministic and unit-tested.
 */
import { parseAmountToPaise } from "@/lib/money";

export type PriceSource = "jsonld" | "meta" | "inline";

export type ExtractedPrice = { pricePaise: number; source: PriceSource };

/** Anything outside ₹1–₹10,00,000 is page noise (EMI, delivery, rating count…). */
const MIN_PAISE = 100;
const MAX_PAISE = 100_000_000;

export function isPlausiblePrice(paise: number | null): paise is number {
  return paise != null && paise >= MIN_PAISE && paise <= MAX_PAISE;
}

/** "₹2,499.00" / "2499" / "1,299.50" → paise. Null when it isn't a usable amount. */
export function parsePriceText(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    const paise = parseAmountToPaise(raw);
    return isPlausiblePrice(paise) ? paise : null;
  }
  const cleaned = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const paise = parseAmountToPaise(cleaned.replace(/,/g, ""));
  return isPlausiblePrice(paise) ? paise : null;
}

type Candidate = { paise: number; currency?: string };

/** Walk a parsed JSON-LD document collecting price-ish values, keeping INR first. */
function collectJsonLdPrices(node: unknown, acc: Candidate[], depth = 0): void {
  if (depth > 8 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectJsonLdPrices(n, acc, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  const currency =
    typeof obj.priceCurrency === "string" ? obj.priceCurrency.toUpperCase() : undefined;

  for (const key of ["price", "lowPrice"]) {
    const value = obj[key];
    if (typeof value !== "number" && typeof value !== "string") continue;
    const paise = parsePriceText(value);
    if (paise) acc.push({ paise, currency });
  }
  for (const value of Object.values(obj)) collectJsonLdPrices(value, acc, depth + 1);
}

function fromJsonLd(html: string): number | null {
  const acc: Candidate[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      collectJsonLdPrices(JSON.parse(match[1].trim()), acc);
    } catch {
      // malformed block (or a store's custom template) — try the next one
    }
  }
  const inr = acc.find((c) => c.currency === "INR" || c.currency === "INR.");
  if (inr) return inr.paise;
  return acc.length > 0 ? acc[0].paise : null;
}

/** `<meta property="product:price:amount" content="2499.00">` and friends. */
function fromMeta(html: string): number | null {
  const keys = ["product:price:amount", "og:price:amount", "twitter:data1", "price"];
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
      "i"
    );
    const m = html.match(re);
    const paise = parsePriceText(m?.[1]);
    if (paise) return paise;
  }
  const itemprop = html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i);
  return parsePriceText(itemprop?.[1]);
}

/** Last resort: the visible price markup each store renders server-side. */
const INLINE_PATTERNS: RegExp[] = [
  /class="a-price-whole"[^>]*>\s*([\d,]{1,9})/i, // Amazon
  /class="[^"]*_30jeq3[^"]*"[^>]*>\s*₹?\s*([\d,]{1,9})/i, // Flipkart
  /class="[^"]*pdp-price[^"]*"[^>]*>[^<]*₹\s*([\d,]{1,9})/i, // Myntra
  /"(?:priceAmount|finalPrice)"\s*:\s*"?(\d{2,8}(?:\.\d{1,2})?)"?/i,
  /"price"\s*:\s*"?(\d{2,8}(?:\.\d{1,2})?)"?/i,
];

function fromInline(html: string): number | null {
  for (const re of INLINE_PATTERNS) {
    const m = html.match(re);
    const paise = parsePriceText(m?.[1]);
    if (paise) return paise;
  }
  return null;
}

/**
 * Amazon buybox markup, most specific first. Amazon serves a price-less page to
 * desktop user agents, so the fetcher asks with a mobile UA; the buybox then
 * publishes its own price JSON (`mobile_buybox_group_1`), and the visible price
 * sits in `.a-offscreen` (a ₹ string) inside `#corePrice_feature_div` or the
 * older `#priceblock_*price` element. Carousel and "other edition" blocks carry
 * prices too, so the first ₹ on the page is only the last resort.
 */
const AMAZON_PATTERNS: RegExp[] = [
  // The buybox's own price data — exact, and present on in-stock pages.
  /"mobile_buybox_group_1"\s*:\s*\[\s*\{[^}]*"priceAmount"\s*:\s*([\d.]+)/i,
  /id="corePrice[^"]*_feature_div"[\s\S]{0,4000}?class="a-offscreen">\s*([^<]+)</i,
  /id="priceblock_(?:our|deal|sale)price"[^>]*>\s*([^<]+)</i,
  /data-a-color="price"[\s\S]{0,800}?class="a-offscreen">\s*([^<]+)</i,
  /class="a-offscreen">\s*₹\s*([\d,]{1,9}(?:\.\d{1,2})?)\s*</i,
  /class="a-price-whole"[^>]*>\s*([\d,]{1,9})/i,
];

function fromAmazon(html: string): number | null {
  for (const re of AMAZON_PATTERNS) {
    const paise = parsePriceText(html.match(re)?.[1]);
    if (paise) return paise;
  }
  return null;
}

/** Extract the current selling price from a product page's HTML. */
export function extractPriceFromHtml(html: string): ExtractedPrice | null {
  const jsonld = fromJsonLd(html);
  if (jsonld) return { pricePaise: jsonld, source: "jsonld" };
  const meta = fromMeta(html);
  if (meta) return { pricePaise: meta, source: "meta" };
  const amazon = fromAmazon(html);
  if (amazon) return { pricePaise: amazon, source: "inline" };
  const inline = fromInline(html);
  if (inline) return { pricePaise: inline, source: "inline" };
  return null;
}

/** True when the page we got back is a bot check rather than the product. */
export function looksBlocked(html: string): boolean {
  return /enter the characters you see|robot check|are you a human|access denied|captcha|unusual traffic/i.test(
    html.slice(0, 4000)
  );
}

/** Readable page text for the AI fallback — scripts/styles/tags stripped. */
export function htmlToText(html: string, limit = 6000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

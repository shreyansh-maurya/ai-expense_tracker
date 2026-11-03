import { detectStoreFromUrl, type WishlistStore } from "@/lib/validators/wishlist";
import {
  extractPriceFromHtml,
  htmlToText,
  looksBlocked,
  parsePriceText,
  type PriceSource,
} from "@/lib/price-extract";
import { WISHLIST_STORE_LABELS } from "@/lib/wishlist-stores";
import { ServiceError } from "./errors";

/**
 * Live price fetching for a wishlist product link.
 *
 * Store pages are fetched server-side with a browser-like request, the price is
 * read from the page's structured data, and — when that finds nothing — the
 * existing AI provider gets one pass over the page text. This is the only place
 * the app talks to a store, and it's always user-initiated.
 */

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
/**
 * Amazon strips the buybox out of the page it serves to desktop user agents, but
 * the same product URL requested as a phone still carries the live price.
 */
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const isAmazonHost = (host: string) => /(^|\.)amazon\./i.test(host);

const FETCH_TIMEOUT_MS = 10_000;
const AI_TIMEOUT_MS = 12_000;

export type FetchedPrice = {
  store: WishlistStore;
  pricePaise: number;
  source: PriceSource | "ai";
};

/**
 * Amazon and Flipkart render prices with JavaScript and drop requests from
 * datacenter IPs, so a plain fetch gets a page with no price at all. Set
 * PRICE_FETCH_PROXY_URL to any scraping gateway that takes the target as a URL
 * parameter — e.g. "https://api.scraperapi.com?api_key=KEY&render=true&url={url}"
 * — and product requests are routed through it instead.
 */
function viaProxy(targetUrl: string): string {
  const template = process.env.PRICE_FETCH_PROXY_URL?.trim();
  if (!template) return targetUrl;
  const encoded = encodeURIComponent(targetUrl);
  return template.includes("{url}")
    ? template.replaceAll("{url}", encoded)
    : `${template}${encoded}`;
}

const label = (store: WishlistStore) => WISHLIST_STORE_LABELS[store] ?? store;

async function fetchProductHtml(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ServiceError("That product link isn't a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ServiceError("Only http(s) product links can be checked");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(viaProxy(parsed.toString()), {
      headers: {
        "User-Agent": isAmazonHost(parsed.hostname) ? MOBILE_UA : DESKTOP_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ServiceError(`The store returned ${res.status} — try again later`);
    }
    return await res.text();
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    const aborted = e instanceof Error && e.name === "AbortError";
    throw new ServiceError(
      aborted ? "The store took too long to respond" : "Couldn't reach the store page"
    );
  } finally {
    clearTimeout(timer);
  }
}

/** One AI pass over the page text when structured extraction finds no price. */
async function priceWithAI(pageText: string): Promise<number | null> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || !pageText) return null;

  const baseUrl = process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Extract the current selling price in Indian rupees from this product page text. Ignore MRP/discounts, EMI amounts, delivery fees, coupons and ratings. Respond with JSON only: {"priceInr": <number or null>}.',
          },
          { role: "user", content: pageText },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { priceInr?: number | string | null };
    return parsePriceText(parsed.priceInr ?? null);
  } catch {
    // No key, timeout, bad JSON — the caller reports "price not found".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the live price of one product link, plus the store it belongs to. */
export async function fetchPriceForItem(
  url: string,
  fallbackStore?: WishlistStore | null
): Promise<FetchedPrice> {
  const store = detectStoreFromUrl(url) ?? fallbackStore ?? "OTHER";
  const html = await fetchProductHtml(url);

  const extracted = extractPriceFromHtml(html);
  if (extracted) {
    return { store, pricePaise: extracted.pricePaise, source: extracted.source };
  }

  const viaAI = await priceWithAI(htmlToText(html));
  if (viaAI) return { store, pricePaise: viaAI, source: "ai" };

  throw new ServiceError(
    looksBlocked(html)
      ? `${label(store)} blocked the automated check — add this price manually`
      : `No price found on the ${label(store)} page`
  );
}

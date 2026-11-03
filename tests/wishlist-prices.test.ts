import { describe, expect, it } from "vitest";
import {
  checkableStores,
  isAtAllTimeLow,
  lowestEverPrice,
  storeSearchUrl,
  summarizeQuotes,
  summarizeTrend,
  type PricePoint,
  type PriceQuoteLike,
} from "../src/lib/wishlist-prices";

function quote(store: string, rupees: number, overrides: Partial<PriceQuoteLike> = {}): PriceQuoteLike {
  return {
    id: `q-${store}`,
    store,
    pricePaise: rupees * 100,
    url: null,
    checkedAt: new Date("2026-10-27T00:00:00Z"),
    ...overrides,
  };
}

function point(store: string, rupees: number, day: number): PricePoint {
  return {
    store,
    pricePaise: rupees * 100,
    recordedAt: new Date(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`),
  };
}

describe("storeSearchUrl", () => {
  it("builds per-store search links for the item title", () => {
    expect(storeSearchUrl("AMAZON", "Sony WH-1000XM5")).toBe(
      "https://www.amazon.in/s?k=Sony%20WH-1000XM5"
    );
    expect(storeSearchUrl("FLIPKART", "iPhone 15")).toBe(
      "https://www.flipkart.com/search?q=iPhone%2015"
    );
    expect(storeSearchUrl("MYNTRA", "running shoes")).toBe(
      "https://www.myntra.com/?rawQuery=running%20shoes"
    );
  });

  it("encodes specials", () => {
    // encodeURIComponent escapes spaces and quotes; parens are URL-safe and pass through
    expect(storeSearchUrl("CROMA", "LED TV 55\" (2024)")).toBe(
      'https://www.croma.com/searchB?q=LED%20TV%2055%22%20(2024)'
    );
  });

  it("returns null for OTHER and blank titles", () => {
    expect(storeSearchUrl("OTHER", "Anything")).toBeNull();
    expect(storeSearchUrl("AMAZON", "   ")).toBeNull();
  });
});

describe("checkableStores", () => {
  it("excludes OTHER and already-quoted stores, keeping registry order", () => {
    expect(checkableStores(["AMAZON", "FLIPKART", "OTHER"])).toEqual([
      "MYNTRA",
      "AJIO",
      "MEESHO",
      "CROMA",
      "NYKAA",
      "TATA_CLIQ",
    ]);
  });

  it("returns the full checkable registry when nothing is quoted", () => {
    expect(checkableStores([])).not.toContain("OTHER");
    expect(checkableStores([])).toContain("TATA_CLIQ");
  });
});

describe("summarizeQuotes", () => {
  it("returns null for empty quotes", () => {
    expect(summarizeQuotes([])).toBeNull();
  });

  it("finds the best store and savings vs the highest", () => {
    const s = summarizeQuotes([
      quote("MYNTRA", 1999),
      quote("FLIPKART", 1299),
      quote("AMAZON", 1499),
    ]);
    expect(s).not.toBeNull();
    expect(s!.best.store).toBe("FLIPKART");
    expect(s!.best.pricePaise).toBe(129900);
    expect(s!.highest!.store).toBe("MYNTRA");
    expect(s!.savingsPaise).toBe(70000);
    expect(s!.savingsPct).toBe(35); // 700/1999 ≈ 35.0%
    expect(s!.count).toBe(3);
  });

  it("single quote: no savings target, yet still a best", () => {
    const s = summarizeQuotes([quote("AMAZON", 499)]);
    expect(s!.best.store).toBe("AMAZON");
    expect(s!.highest).toBeNull();
    expect(s!.savingsPaise).toBe(0);
    expect(s!.savingsPct).toBe(0);
  });

  it("best breaks ties alphabetically, highest too", () => {
    // AJIO and NYKAA tie at 999 — alphabetical fallback puts AJIO before NYKAA,
    // so NYKAA lands last (highest) and AJIO would be best if no MEESHO rows existed.
    const s = summarizeQuotes([quote("NYKAA", 999), quote("AJIO", 999), quote("MEESHO", 800)]);
    expect(s!.best.store).toBe("MEESHO");
    expect(s!.highest!.store).toBe("NYKAA");
    const tie = summarizeQuotes([quote("NYKAA", 999), quote("AJIO", 999)]);
    expect(tie!.best.store).toBe("AJIO");
    expect(tie!.highest!.store).toBe("NYKAA");
    expect(tie!.savingsPaise).toBe(0);
  });

  it("ignores zero/negative prices", () => {
    const s = summarizeQuotes([quote("AMAZON", 0), quote("FLIPKART", 100), quote("CROMA", 300)]);
    expect(s!.count).toBe(2);
    expect(s!.best.store).toBe("FLIPKART");
  });
});

describe("summarizeTrend", () => {
  it("needs at least two readings — one price is not a trend", () => {
    expect(summarizeTrend([])).toBeNull();
    expect(summarizeTrend([point("AMAZON", 1499, 1)])).toBeNull();
    // zero prices are noise and don't create a trend on their own
    expect(summarizeTrend([point("AMAZON", 1499, 1), point("AMAZON", 0, 2)])).toBeNull();
  });

  it("reports a price drop with percentage and all-time low", () => {
    const t = summarizeTrend([
      point("AMAZON", 2000, 1),
      point("AMAZON", 1500, 10),
      point("AMAZON", 1200, 20),
    ]);
    expect(t).not.toBeNull();
    expect(t!.samples).toBe(3);
    expect(t!.firstPaise).toBe(200000);
    expect(t!.lastPaise).toBe(120000);
    expect(t!.deltaPaise).toBe(-80000);
    expect(t!.deltaPct).toBe(40);
    expect(t!.direction).toBe("down");
    expect(t!.lowestPaise).toBe(120000);
    expect(t!.isAllTimeLow).toBe(true);
  });

  it("reports a rise, and flags that the latest is not the cheapest seen", () => {
    const t = summarizeTrend([point("CROMA", 999, 1), point("CROMA", 1299, 5)]);
    expect(t!.deltaPaise).toBe(30000);
    expect(t!.deltaPct).toBe(30);
    expect(t!.direction).toBe("up");
    expect(t!.lowestPaise).toBe(99900);
    expect(t!.isAllTimeLow).toBe(false);
  });

  it("is flat when the price never moved, and still an all-time low", () => {
    const t = summarizeTrend([point("NYKAA", 899, 1), point("NYKAA", 899, 9)]);
    expect(t!.direction).toBe("flat");
    expect(t!.deltaPaise).toBe(0);
    expect(t!.deltaPct).toBe(0);
    expect(t!.isAllTimeLow).toBe(true);
  });

  it("orders unordered readings chronologically", () => {
    const t = summarizeTrend([
      point("MEESHO", 700, 15),
      point("MEESHO", 900, 1),
      point("MEESHO", 800, 9),
    ]);
    expect(t!.firstPaise).toBe(90000);
    expect(t!.lastPaise).toBe(70000);
    expect(t!.direction).toBe("down");
  });

  it("keeps the lowest across a middle dip", () => {
    const t = summarizeTrend([
      point("AJIO", 1500, 1),
      point("AJIO", 1100, 5),
      point("AJIO", 1400, 20),
    ]);
    expect(t!.lowestPaise).toBe(110000);
    expect(t!.isAllTimeLow).toBe(false);
    expect(t!.direction).toBe("down");
  });
});

describe("lowestEverPrice", () => {
  it("returns null without usable history", () => {
    expect(lowestEverPrice([])).toBeNull();
    expect(lowestEverPrice([point("AMAZON", 0, 1)])).toBeNull();
  });

  it("picks the cheapest price across stores", () => {
    const low = lowestEverPrice([
      point("AMAZON", 1499, 1),
      point("FLIPKART", 1099, 4),
      point("CROMA", 1899, 6),
    ]);
    expect(low!.store).toBe("FLIPKART");
    expect(low!.pricePaise).toBe(109900);
    expect(low!.recordedAt.toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });

  it("keeps the earliest sighting when prices tie", () => {
    const low = lowestEverPrice([
      point("AMAZON", 999, 12),
      point("FLIPKART", 999, 3),
      point("MEESHO", 1200, 1),
    ]);
    expect(low!.store).toBe("FLIPKART");
    expect(low!.recordedAt.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});

describe("isAtAllTimeLow", () => {
  it("needs real history — a single reading is not an all-time low", () => {
    expect(isAtAllTimeLow(99900, [point("AMAZON", 999, 1)])).toBe(false);
    expect(isAtAllTimeLow(99900, [])).toBe(false);
  });

  it("is true only when the current best equals the cheapest ever seen", () => {
    const history = [point("AMAZON", 1499, 1), point("AMAZON", 999, 5)];
    expect(isAtAllTimeLow(99900, history)).toBe(true);
    expect(isAtAllTimeLow(129900, history)).toBe(false);
  });
});

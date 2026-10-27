import { describe, expect, it } from "vitest";
import {
  checkableStores,
  storeSearchUrl,
  summarizeQuotes,
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

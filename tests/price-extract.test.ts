import { describe, expect, it } from "vitest";
import {
  extractPriceFromHtml,
  htmlToText,
  isPlausiblePrice,
  looksBlocked,
  parsePriceText,
} from "../src/lib/price-extract";

const jsonLdPage = (body: object) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(body)}</script></head><body></body></html>`;

describe("parsePriceText", () => {
  it("parses Indian-formatted prices to paise", () => {
    expect(parsePriceText("₹2,499.00")).toBe(249900);
    expect(parsePriceText("2499")).toBe(249900);
    expect(parsePriceText("1,29,999")).toBe(12999900);
    expect(parsePriceText(2499)).toBe(249900);
    expect(parsePriceText("₹ 1,299.50")).toBe(129950);
  });

  it("rejects junk and implausible amounts", () => {
    expect(parsePriceText(null)).toBeNull();
    expect(parsePriceText("")).toBeNull();
    expect(parsePriceText("out of stock")).toBeNull();
    expect(parsePriceText("₹0.50")).toBeNull(); // below ₹1
    expect(parsePriceText("₹99,00,000")).toBeNull(); // above the ₹10L sanity cap
  });
});

describe("isPlausiblePrice", () => {
  it("keeps real product prices and rejects noise", () => {
    expect(isPlausiblePrice(249900)).toBe(true);
    expect(isPlausiblePrice(100)).toBe(true);
    expect(isPlausiblePrice(99)).toBe(false);
    expect(isPlausiblePrice(null)).toBe(false);
  });
});

describe("extractPriceFromHtml", () => {
  it("reads a schema.org Offer from JSON-LD", () => {
    const html = jsonLdPage({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Headphones",
      offers: { "@type": "Offer", price: "2499.00", priceCurrency: "INR" },
    });
    expect(extractPriceFromHtml(html)).toEqual({ pricePaise: 249900, source: "jsonld" });
  });

  it("handles an @graph wrapper and prefers INR when several currencies are present", () => {
    const html = jsonLdPage({
      "@graph": [
        { "@type": "Offer", price: 120, priceCurrency: "USD" },
        { "@type": "Offer", price: "2,299", priceCurrency: "INR" },
      ],
    });
    expect(extractPriceFromHtml(html)?.pricePaise).toBe(229900);
  });

  it("ignores malformed JSON-LD and falls through to the next signal", () => {
    const html = `<html><head><script type="application/ld+json">{not json}</script><meta property="product:price:amount" content="1799"></head></html>`;
    expect(extractPriceFromHtml(html)).toEqual({ pricePaise: 179900, source: "meta" });
  });

  it("reads price meta tags", () => {
    const html = `<html><head><meta property="og:price:amount" content="1,499.00"></head></html>`;
    expect(extractPriceFromHtml(html)).toEqual({ pricePaise: 149900, source: "meta" });
  });

  it("reads the store's inline price markup when there is no structured data", () => {
    const amazon = `<span class="a-price-whole">2,499<span class="a-price-decimal">.</span></span>`;
    expect(extractPriceFromHtml(amazon)).toEqual({ pricePaise: 249900, source: "inline" });

    const flipkart = `<div class="_30jeq3 _1BLPMq">₹22,999</div>`;
    expect(extractPriceFromHtml(flipkart)).toEqual({ pricePaise: 2299900, source: "inline" });

    const myntra = `<span class="pdp-price">₹ 899</span>`;
    expect(extractPriceFromHtml(myntra)).toEqual({ pricePaise: 89900, source: "inline" });
  });

  it("reads a big price without Indian grouping overflow", () => {
    expect(extractPriceFromHtml(jsonLdPage({ price: 129999, priceCurrency: "INR" }))?.pricePaise).toBe(
      12999900
    );
  });

  it("returns null when the page has no price", () => {
    expect(extractPriceFromHtml("<html><body>Out of stock</body></html>")).toBeNull();
  });
});

describe("Amazon buybox markup", () => {
  it("reads the price from the core price block", () => {
    const html = `<div id="corePrice_feature_div" class="a-section"><span class="a-price"><span class="a-offscreen">₹73,990.00</span><span aria-hidden="true"><span class="a-price-symbol">₹</span><span class="a-price-whole">73,990</span></span></span></div>`;
    expect(extractPriceFromHtml(html)).toEqual({ pricePaise: 7399000, source: "inline" });
  });

  it("prefers the buybox JSON over carousel and other-edition prices", () => {
    const html = `<span class="a-offscreen">₹278.00</span>
      <script type="a-state">{"mobile_buybox_group_1":[{"displayPrice":"₹470.00","priceAmount":470.00,"currencySymbol":"₹"}]}</script>
      <div data-a-color="price"><span class="a-offscreen">₹1,415.00</span></div>`;
    expect(extractPriceFromHtml(html)?.pricePaise).toBe(47000);
  });

  it("prefers the buybox over a related-product carousel price", () => {
    const html = `<div id="corePrice_feature_div"><span class="a-offscreen">₹2,499.00</span></div>
      <div class="carousel"><span class="a-offscreen">₹474.00</span></div>`;
    expect(extractPriceFromHtml(html)?.pricePaise).toBe(249900);
  });

  it("falls back to the visible whole-price span", () => {
    const html = `<span class="a-price"><span class="a-price-symbol">₹</span><span class="a-price-whole">278</span></span>`;
    expect(extractPriceFromHtml(html)?.pricePaise).toBe(27800);
  });
});

describe("looksBlocked", () => {
  it("recognises bot-check pages", () => {
    expect(looksBlocked("<title>Robot Check</title>Enter the characters you see below")).toBe(true);
    expect(looksBlocked("<html>Are you a human?</html>")).toBe(true);
    expect(looksBlocked("<html><body>Great headphones</body></html>")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles and tags", () => {
    const text = htmlToText(
      `<html><script>var a = 1;</script><style>.x{}</style><h1>Earbuds</h1><p>Only ₹1,999</p></html>`
    );
    expect(text).toBe("Earbuds Only ₹1,999");
  });

  it("caps the text length", () => {
    expect(htmlToText(`<p>${"a".repeat(500)}</p>`, 100)).toHaveLength(100);
  });
});

import { describe, expect, it } from "vitest";
import { detectStoreFromUrl } from "../src/lib/wishlist-stores";
import { wishlistInputSchema, wishlistStatusSchema } from "../src/lib/validators/wishlist";

describe("detectStoreFromUrl", () => {
  it("detects Indian store links", () => {
    expect(detectStoreFromUrl("https://www.amazon.in/dp/B0EXAMPLE")).toBe("AMAZON");
    expect(detectStoreFromUrl("https://amazon.com/gp/product/B0X")).toBe("AMAZON");
    expect(detectStoreFromUrl("https://amzn.to/abc123")).toBe("AMAZON");
    expect(detectStoreFromUrl("https://www.flipkart.com/some/product")).toBe("FLIPKART");
    expect(detectStoreFromUrl("https://fkrt.it/x1Y2!z")).toBe("FLIPKART");
    expect(detectStoreFromUrl("https://www.myntra.com/shoes/12345/buy")).toBe("MYNTRA");
    expect(detectStoreFromUrl("https://www.ajio.com/some-item/p/456")).toBe("AJIO");
    expect(detectStoreFromUrl("https://www.meesho.com/item/p/xyz")).toBe("MEESHO");
    expect(detectStoreFromUrl("https://www.croma.com/product/789")).toBe("CROMA");
    expect(detectStoreFromUrl("https://www.nykaa.com/beauty/p/1")).toBe("NYKAA");
    expect(detectStoreFromUrl("https://www.tatacliq.com/queens/p/2")).toBe("TATA_CLIQ");
  });

  it("tolerates links pasted without a scheme", () => {
    expect(detectStoreFromUrl("www.amazon.in/dp/B0X")).toBe("AMAZON");
    expect(detectStoreFromUrl("amazon.in/dp/B0X")).toBe("AMAZON");
  });

  it("returns null for unknown stores and junk", () => {
    expect(detectStoreFromUrl("https://www.my-shop.example/p/1")).toBeNull();
    expect(detectStoreFromUrl("")).toBeNull();
    expect(detectStoreFromUrl(null)).toBeNull();
    expect(detectStoreFromUrl("not a url")).toBeNull();
  });

  it("does not match lookalike hosts", () => {
    expect(detectStoreFromUrl("https://notamazon.example.com/p")).toBeNull();
    expect(detectStoreFromUrl("https://flipkart-clone.io/p")).toBeNull();
  });
});

describe("wishlistInputSchema", () => {
  it("accepts a full item and defaults priority", () => {
    const parsed = wishlistInputSchema.safeParse({
      title: "Wireless earbuds",
      url: "https://www.amazon.in/dp/B0X",
      price: "2,499",
      notes: "  ",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.priority).toBe("MEDIUM");
    expect(parsed.data.notes).toBe("");
    expect(parsed.data.store).toBeUndefined(); // server detects from URL
  });

  it("requires a title", () => {
    const parsed = wishlistInputSchema.safeParse({ title: "   " });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-http URLs", () => {
    const parsed = wishlistInputSchema.safeParse({
      title: "Shoes",
      url: "javascript:alert(1)",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const parsed = wishlistInputSchema.safeParse({ title: "Shoes", url: "amazon in dp 123" });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid price strings (parse happens in the action, but the field must be a string)", () => {
    const parsed = wishlistInputSchema.safeParse({ title: "Shoes", price: 42.5 });
    // numbers are not user-entered strings — schema rejects to keep the contract strict
    expect(parsed.success).toBe(false);
  });
});

describe("wishlistStatusSchema", () => {
  it("accepts known statuses only", () => {
    expect(wishlistStatusSchema.safeParse("WANTED").success).toBe(true);
    expect(wishlistStatusSchema.safeParse("ORDERED").success).toBe(true);
    expect(wishlistStatusSchema.safeParse("BOUGHT").success).toBe(true);
    expect(wishlistStatusSchema.safeParse("DROPPED").success).toBe(true);
    expect(wishlistStatusSchema.safeParse("LOST").success).toBe(false);
    expect(wishlistStatusSchema.safeParse("").success).toBe(false);
  });
});

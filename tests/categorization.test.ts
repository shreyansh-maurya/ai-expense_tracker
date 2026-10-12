import { describe, expect, it } from "vitest";
import {
  prepareCategories,
  suggestCategory,
  suggestFromText,
} from "../src/lib/services/categorization";

const CATS = [
  {
    id: "cat-food",
    name: "Food & Dining",
    keywords: "swiggy, zomato, restaurant, cafe, food",
  },
  {
    id: "cat-transport",
    name: "Transport",
    keywords: "uber, ola, rapido, petrol, fuel, cab",
  },
  {
    id: "cat-other",
    name: "Other",
    keywords: "misc, miscellaneous",
  },
  {
    id: "cat-archived",
    name: "Old Category",
    keywords: "legacy, archived-thing",
    isArchived: true,
  },
];

const prepared = prepareCategories(CATS);

describe("prepareCategories", () => {
  it("splits keywords and drops archived / keyword-less categories", () => {
    expect(prepared).toHaveLength(3);
    expect(prepared.find((c) => c.id === "cat-archived")).toBeUndefined();
    const food = prepared.find((c) => c.id === "cat-food")!;
    expect(food.keywordList).toEqual(["swiggy", "zomato", "restaurant", "cafe", "food"]);
  });
});

describe("suggestFromText", () => {
  it("matches a keyword anywhere in the text", () => {
    expect(suggestFromText("Uber ride to office", prepared)?.categoryId).toBe("cat-transport");
    expect(suggestFromText("lunch at chaayos cafe", prepared)?.categoryId).toBe("cat-food");
  });

  it("is case-insensitive", () => {
    expect(suggestFromText("SWIGGY order", prepared)?.categoryId).toBe("cat-food");
  });

  it("does not fire on substring vs word boundary", () => {
    // "food" must not match inside "seafood marketplace"
    expect(suggestFromText("seafood marketplace", prepared)).toBeNull();
    // but a full word must match
    expect(suggestFromText("food court", prepared)?.categoryId).toBe("cat-food");
  });

  it("returns null for empty or unmatched text", () => {
    expect(suggestFromText("", prepared)).toBeNull();
    expect(suggestFromText("   ", prepared)).toBeNull();
    expect(suggestFromText("totally unrelated thing", prepared)).toBeNull();
  });

  it("prefers the longest keyword on overlap", () => {
    const cats = [
      { id: "a", name: "A", keywords: "petrol" },
      { id: "b", name: "B", keywords: "petrol pump" },
    ];
    expect(suggestFromText("filled at petrol pump", prepareCategories(cats))?.categoryId).toBe("b");
  });
});

describe("suggestCategory", () => {
  it("matches merchant first", () => {
    const s = suggestCategory(
      { merchant: "Uber", notes: "cafe meeting" },
      prepared
    );
    expect(s?.categoryId).toBe("cat-transport");
    expect(s?.source).toBe("RULE");
  });

  it("falls back to notes when merchant has no match", () => {
    expect(suggestCategory({ merchant: "unknown shop", notes: "swiggy delivery" }, prepared)?.categoryId).toBe(
      "cat-food"
    );
  });

  it("returns null when neither merchant nor notes match", () => {
    expect(suggestCategory({ merchant: "weird", notes: "nothing" }, prepared)).toBeNull();
  });

  it("returns null when everything is empty", () => {
    expect(suggestCategory({ merchant: null, notes: null }, prepared)).toBeNull();
    expect(suggestCategory({}, prepared)).toBeNull();
  });
});

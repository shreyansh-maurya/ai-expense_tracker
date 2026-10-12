import type { Category } from "@prisma/client";

/**
 * Deterministic keyword-rule auto-categorization (Phase B, no AI key required).
 *
 * Checks the merchant text first, then notes, against each category's
 * comma-separated `keywords` column. Word-boundary matching so "food" does
 * not match "software feed" — but "uber" matches "Uber ride to office".
 */

export type CategoryLike = Pick<Category, "id" | "name" | "keywords"> & {
  isArchived?: boolean;
};

export type Suggestion = {
  categoryId: string;
  categoryName: string;
  /** Which keyword triggered the match (for UI display / debugging). */
  matchedKeyword: string;
  source: "RULE";
};

/** Pre-split keyword lists once so repeated suggestions don't re-split. */
type PreparedCategory = CategoryLike & { keywordList: string[] };

export function prepareCategories(categories: CategoryLike[]): PreparedCategory[] {
  return categories
    .filter((c) => !c.isArchived && c.keywords && c.keywords.trim() !== "")
    .map((c) => ({
      ...c,
      keywordList: c
        .keywords!.split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Unicode-aware word-boundary check. `\\b` alone mishandles Indic and
 * other non-ASCII text, so we compare neighbors against letter/id chars.
 */
function hasWordBoundary(textLower: string, keyword: string): boolean {
  const idx = textLower.indexOf(keyword);
  if (idx === -1) return false;
  const isWordChar = (ch: string | undefined) =>
    ch !== undefined && /[a-z0-9\u00C0-\u024F\u0900-\u097F]/i.test(ch);
  let from = 0;
  while (true) {
    const at = textLower.indexOf(keyword, from);
    if (at === -1) return false;
    const before = at > 0 ? textLower[at - 1] : undefined;
    const after = textLower[at + keyword.length];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
}

export function suggestFromText(
  text: string,
  prepared: PreparedCategory[]
): Suggestion | null {
  const lower = text.toLowerCase();
  if (lower.trim() === "" || prepared.length === 0) return null;

  // Longest keyword first so "petrol pump" wins over bare "petrol".
  const candidates: Array<{ cat: PreparedCategory; kw: string }> = [];
  for (const cat of prepared) {
    for (const kw of cat.keywordList) {
      if (kw.length > 0 && hasWordBoundary(lower, kw)) {
        candidates.push({ cat, kw });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.kw.length - a.kw.length);
  const best = candidates[0];
  return {
    categoryId: best.cat.id,
    categoryName: best.cat.name,
    matchedKeyword: best.kw,
    source: "RULE",
  };
}

/**
 * Suggest a category for an expense from its merchant and notes.
 * Merchant text takes priority over notes.
 */
export function suggestCategory(
  { merchant, notes }: { merchant?: string | null; notes?: string | null },
  prepared: PreparedCategory[]
): Suggestion | null {
  if (merchant && merchant.trim() !== "") {
    const hit = suggestFromText(merchant, prepared);
    if (hit) return hit;
  }
  if (notes && notes.trim() !== "") {
    return suggestFromText(notes, prepared);
  }
  return null;
}

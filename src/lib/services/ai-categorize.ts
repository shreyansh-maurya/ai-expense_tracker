import { prepareCategories, suggestCategory, type CategoryLike } from "./categorization";

/**
 * Provider-agnostic AI auto-categorization (Phase B).
 *
 * Enabled only when AI_API_KEY is present (plus optional AI_BASE_URL /
 * AI_MODEL / AI_PROVIDER from the README roadmap — any OpenAI-compatible
 * endpoint works). Without a key the deterministic keyword rules are the
 * whole story; the app never requires AI to function.
 */

export type AISuggestion = {
  categoryId: string;
  categoryName: string;
  source: "AI";
};

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

function aiBaseUrl(): string {
  return process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1";
}

function aiModel(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o-mini";
}

/** Tiny proactive timeout — categorization must never hang an import. */
const AI_TIMEOUT_MS = 12_000;

/** Classify a handful of expenses in one request; index-aligned results. */
async function classifyWithAI(
  items: Array<{ merchant?: string | null; notes?: string | null }>,
  categories: CategoryLike[]
): Promise<Array<AISuggestion | null>> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || items.length === 0) return items.map(() => null);

  const categoryList = categories
    .filter((c) => !c.isArchived)
    .map((c) => c.name)
    .join(" | ");

  const payload = items.map((it, i) => ({
    index: i,
    merchant: it.merchant ?? "",
    notes: (it.notes ?? "").slice(0, 200),
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: aiModel(),
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You categorize personal expenses for an India-based tracker. Choose exactly one category name from this list for each item:\n${categoryList}\nRespond with JSON: {"categories":[{"index":<number>,"category":"<exact name from list>"}]}. Every item must get an answer.`,
          },
          {
            role: "user",
            content: JSON.stringify({ items: payload }),
          },
        ],
      }),
    });
    if (!res.ok) return items.map(() => null);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return items.map(() => null);

    const parsed = JSON.parse(raw) as {
      categories?: Array<{ index?: number; category?: string }>;
    };
    const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
    const out: Array<AISuggestion | null> = items.map(() => null);
    for (const c of parsed.categories ?? []) {
      if (
        typeof c.index === "number" &&
        c.index >= 0 &&
        c.index < out.length &&
        typeof c.category === "string"
      ) {
        const cat = byName.get(c.category.toLowerCase());
        if (cat) out[c.index] = { categoryId: cat.id, categoryName: cat.name, source: "AI" };
      }
    }
    return out;
  } catch {
    // Network/parse/timeout — rules-only behavior, never fail the write.
    return items.map(() => null);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Suggest categories for a batch: keyword rules first, then AI only for the
 * rows rules could not place. Guarded so every path returns per-row results.
 */
export async function suggestCategoriesBatch(
  rows: Array<{ merchant?: string | null; notes?: string | null }>,
  categories: CategoryLike[]
): Promise<Array<AISuggestion | { categoryId: string; categoryName: string; source: "RULE" } | null>> {
  const prepared = prepareCategories(categories);
  const ruleResults = rows.map((r) => suggestCategory(r, prepared));

  const needAI: number[] = [];
  ruleResults.forEach((r, i) => {
    if (r === null && isAIConfigured()) needAI.push(i);
  });

  let aiResults: Array<AISuggestion | null> = needAI.map(() => null);
  if (needAI.length > 0) {
    aiResults = await classifyWithAI(
      needAI.map((i) => rows[i]),
      categories
    );
  }

  let aiCursor = 0;
  return ruleResults.map((r, i) => {
    if (r) return r;
    const ai = aiResults[aiCursor++] ?? null;
    if (ai && ai.categoryId !== undefined) return ai;
    return null;
  });
}

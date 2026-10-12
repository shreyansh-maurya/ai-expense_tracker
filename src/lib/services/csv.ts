import { prisma } from "@/lib/db";
import { parseUTCMidnight, dateToISODate, todayISODate } from "@/lib/dates";
import { paiseToDecimalString } from "@/lib/money";
import {
  buildCsv,
  CSV_HEADERS,
  rowKey,
  type PaymentMethod,
} from "@/lib/csv/core";
import { PAYMENT_METHOD_LABELS } from "@/lib/validators/expense";
import { suggestCategoriesBatch } from "./ai-categorize";
import type { Prisma } from "@prisma/client";
import { ServiceError } from "./errors";

const DAY_MS = 86_400_000;

// ── Export ──────────────────────────────────────────────────────────────────

export async function getExpensesForExport({ from, to }: { from?: string; to?: string }) {
  const where: Prisma.ExpenseWhereInput = {};
  const date: Prisma.DateTimeFilter = {};
  const fromDate = from ? parseUTCMidnight(from) : null;
  if (fromDate) date.gte = fromDate;
  const toDate = to ? parseUTCMidnight(to) : null;
  if (toDate) date.lt = new Date(toDate.getTime() + DAY_MS);
  if (Object.keys(date).length > 0) where.date = date;

  return prisma.expense.findMany({
    where,
    include: { category: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

type ExportRow = Awaited<ReturnType<typeof getExpensesForExport>>[number];

export function buildExpensesCsv(rows: ExportRow[]): string {
  return buildCsv(
    CSV_HEADERS,
    rows.map((r) => [
      dateToISODate(r.date),
      paiseToDecimalString(r.amountPaise),
      r.category.name,
      PAYMENT_METHOD_LABELS[r.paymentMethod as PaymentMethod] ?? r.paymentMethod,
      r.merchant ?? "",
      r.notes ?? "",
    ])
  );
}

export function buildTemplateCsv(): string {
  return buildCsv(CSV_HEADERS, [
    ["2026-10-06", "250.50", "Food & Dining", "UPI", "Swiggy", "Team lunch"],
    ["2026-10-05", "1200", "Shopping", "Card", "Amazon", "USB cable"],
  ]);
}

export function exportFilename(): string {
  return `expenses-${todayISODate().replaceAll("-", "")}.csv`;
}

// ── Import ──────────────────────────────────────────────────────────────────

export type ImportPayloadRow = {
  dateISO: string;
  amountPaise: number;
  categoryName: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  notes?: string;
};

const MAX_ROWS = 2000;
const PALETTE = [
  "#f97316", "#22c55e", "#3b82f6", "#eab308", "#a855f7",
  "#ec4899", "#14b8a6", "#06b6d4", "#f43f5e", "#8b5cf6",
];

export type ImportResult = {
  created: number;
  skippedInvalid: number;
  skippedDuplicates: number;
  categoriesCreated: number;
};

export async function importExpenseRows(
  rows: ImportPayloadRow[],
  opts: { createMissingCategories: boolean; skipDuplicates: boolean }
): Promise<ImportResult> {
  if (rows.length > MAX_ROWS) {
    throw new ServiceError(`Import is limited to ${MAX_ROWS} rows per batch`);
  }

  // Re-validate everything server-side; never trust the client.
  const valid: ImportPayloadRow[] = [];
  let skippedInvalid = 0;
  for (const r of rows) {
    const date = parseUTCMidnight(r.dateISO);
    if (
      !date ||
      !Number.isInteger(r.amountPaise) ||
      r.amountPaise <= 0 ||
      typeof r.categoryName !== "string"
    ) {
      skippedInvalid++;
      continue;
    }
    valid.push({
      dateISO: r.dateISO,
      amountPaise: r.amountPaise,
      categoryName: r.categoryName.trim().slice(0, 40),
      paymentMethod: r.paymentMethod,
      merchant: (r.merchant ?? "").trim().slice(0, 120),
      notes: (r.notes ?? "").trim().slice(0, 500),
    });
  }
  if (valid.length === 0) {
    return { created: 0, skippedInvalid, skippedDuplicates: 0, categoriesCreated: 0 };
  }

  // ── Auto-categorization (Phase B) ────────────────────────────────────────
  // Rows shipped without a category get keyword-rule suggestions first,
  // then AI (when configured) for whatever rules could not place.
  const existingForSuggest = await prisma.category.findMany({
    select: { id: true, name: true, keywords: true, isArchived: true },
  });
  const uncategorizedIndexes: number[] = [];
  valid.forEach((r, i) => {
    if (r.categoryName.trim() === "") uncategorizedIndexes.push(i);
  });
  const suggestResults =
    uncategorizedIndexes.length > 0
      ? await suggestCategoriesBatch(
          uncategorizedIndexes.map((i) => ({ merchant: valid[i].merchant, notes: valid[i].notes })),
          existingForSuggest
        )
      : [];
  // Per-row categorization provenance: USER unless we suggested it.
  const categorizedBy: string[] = valid.map(() => "USER");
  suggestResults.forEach((s, j) => {
    if (s) {
      const i = uncategorizedIndexes[j];
      valid[i].categoryName = s.categoryName;
      categorizedBy[i] = s.source; // "RULE" | "AI"
    }
  });

  // Resolve categories (create missing ones when allowed).
  const existing = await prisma.category.findMany();
  const byLower = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  let categoriesCreated = 0;

  const rawNameByLower = new Map<string, string>();
  for (const r of valid) {
    if (!rawNameByLower.has(r.categoryName.toLowerCase())) {
      rawNameByLower.set(r.categoryName.toLowerCase(), r.categoryName);
    }
  }
  const missing = [...rawNameByLower.keys()].filter((n) => !byLower.has(n));

  const otherFirst = byLower.get("other");
  if (missing.length > 0 && !opts.createMissingCategories) {
    const fallback =
      otherFirst ??
      (await prisma.category.create({
        data: { name: "Other", color: "#64748b" },
      }));
    byLower.set("other", fallback);
    for (const r of valid) {
      if (!byLower.has(r.categoryName.toLowerCase())) {
        r.categoryName = "Other";
      }
    }
  } else {
    for (let i = 0; i < missing.length; i++) {
      const created = await prisma.category.create({
        data: {
          name: rawNameByLower.get(missing[i])!,
          color: PALETTE[i % PALETTE.length],
        },
      });
      byLower.set(missing[i], created);
      categoriesCreated++;
    }
  }

  // Duplicate detection: against DB and within the batch.
  let skippedDuplicates = 0;
  const batchSeen = new Set<string>();
  const toCreate: Array<Prisma.ExpenseCreateInput> = [];
  let vi = 0; // index into valid[] for categorizedBy lookup

  const merchantNorms = [
    ...new Set(valid.map((r) => (r.merchant ?? "").toLowerCase()).filter(Boolean)),
  ];
  const dates = valid.map((r) => parseUTCMidnight(r.dateISO)!);
  const dbKeySet = new Set<string>();
  if (merchantNorms.length > 0) {
    const dbRows = await prisma.expense.findMany({
      where: {
        merchantNorm: { in: merchantNorms },
        date: { gte: new Date(Math.min(...dates.map((d) => d.getTime()))), lte: new Date(Math.max(...dates.map((d) => d.getTime()))) },
      },
      select: { date: true, amountPaise: true, merchantNorm: true },
    });
    for (const d of dbRows) {
      dbKeySet.add(rowKey(dateToISODate(d.date), d.amountPaise, d.merchantNorm ?? ""));
    }
  }

  for (const r of valid) {
    const key = rowKey(r.dateISO, r.amountPaise, r.merchant ?? "");
    if (opts.skipDuplicates && (dbKeySet.has(key) || batchSeen.has(key))) {
      skippedDuplicates++;
      continue;
    }
    batchSeen.add(key);
    const date = parseUTCMidnight(r.dateISO)!;
    const merchant = r.merchant || null;
    toCreate.push({
      amountPaise: r.amountPaise,
      date,
      paymentMethod: r.paymentMethod,
      merchant,
      merchantNorm: merchant ? merchant.toLowerCase() : null,
      notes: r.notes || null,
      categorizedBy: categorizedBy[vi] ?? "USER",
      category: { connect: { id: byLower.get(r.categoryName.toLowerCase())!.id } },
    });
    vi++;
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += 500) {
    const chunk = toCreate.slice(i, i + 500);
    await prisma.$transaction(chunk.map((data) => prisma.expense.create({ data })));
    created += chunk.length;
  }

  return { created, skippedInvalid, skippedDuplicates, categoriesCreated };
}

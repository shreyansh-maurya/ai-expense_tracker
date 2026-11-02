import { parseAmountToPaise } from "@/lib/money";
import { parseFlexibleDate } from "@/lib/dates";

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "NET_BANKING",
  "WALLET",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CSV_HEADERS = [
  "Date",
  "Amount",
  "Category",
  "Payment Method",
  "Merchant",
  "Notes",
] as const;

/** RFC 4180 escaping: quote fields containing commas, quotes or newlines. */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build a CSV document (CRLF line endings, Excel-friendly BOM added by callers). */
export function buildCsv(header: readonly string[], rows: readonly string[][]): string {
  const lines = [header.map(escapeCsvField).join(",")];
  for (const row of rows) lines.push(row.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}

/** Map free-text payment descriptions to the internal enum. */
export function normalizePaymentMethod(raw: string | undefined | null): PaymentMethod {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "OTHER";
  if (s.includes("upi") || /gpay|google pay|phonepe|paytm/.test(s)) return "UPI";
  if (s.includes("cash")) return "CASH";
  if (s.includes("card")) return "CARD";
  if (/net\s*banking|neft|imps|rtgs|bank transfer|transfer|online/.test(s)) return "NET_BANKING";
  if (/wallet|amazon pay|payzapp/.test(s)) return "WALLET";
  return "OTHER";
}

/** Spreadsheet/markdown exports pad cells and wrap them in pipes: "| 06/10/2026 |". */
export function cleanCell(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/^[\s|]+/, "")
    .replace(/[\s|]+$/, "")
    .trim();
}

/** A row with no values at all — blank lines and `| | |` padding rows. */
export function isBlankRow(raw: Record<string, string>): boolean {
  return Object.values(raw).every((v) => cleanCell(v) === "");
}

/** Markdown table rules (`| --- | :--: |`) are layout, not data. */
export function isSeparatorRow(raw: Record<string, string>): boolean {
  const cells = Object.values(raw).map(cleanCell).filter((c) => c !== "");
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

export type ImportField = "date" | "amount" | "category" | "paymentMethod" | "merchant" | "notes";
export type ColumnMapping = Partial<Record<ImportField, string>>;

/** Header text with `_`, `-`, `.` flattened, so words match across separators. */
function normalizeHeader(header: string): string {
  return cleanCell(header)
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Header keywords per field, most specific first. Matching is scored rather than
 * first-fit: a wide dataset column like `income_type`, `loan_payment` or
 * `debt_to_income_ratio` must not steal Category / Payment method / Merchant.
 */
const FIELD_KEYWORDS: Record<ImportField, string[]> = {
  date: ["transaction date", "txn date", "date", "posted", "when", "day"],
  amount: [
    "transaction amount",
    "monthly expense total",
    "amount",
    "amt",
    "value",
    "total",
    "sum",
    "debit",
    "expense",
    "expenditure",
    "spent",
    "cost",
    "price",
  ],
  category: ["category", "categories", "tag", "type"],
  paymentMethod: ["payment method", "payment mode", "paid via", "method", "mode"],
  merchant: ["merchant", "payee", "vendor", "narration", "description", "party"],
  notes: ["notes", "note", "remarks", "remark", "comment", "memo", "details"],
};

/** Exact name beats a whole-word phrase, which beats a substring of a long header. */
function scoreHeader(header: string, keywords: readonly string[]): number {
  const padded = ` ${header} `;
  let best = 0;
  for (const kw of keywords) {
    if (header === kw) best = Math.max(best, 1000 + kw.length);
    else if (padded.includes(` ${kw} `)) best = Math.max(best, 500 + kw.length * 10 - header.length);
    else if (header.includes(kw)) best = Math.max(best, 200 + kw.length - header.length);
  }
  return best;
}

/** Guess a column mapping from CSV headers; unmatched columns are simply left out. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const field of Object.keys(FIELD_KEYWORDS) as ImportField[]) {
    let bestHeader: string | null = null;
    let bestScore = 0;
    for (const header of headers) {
      if (!header || used.has(header)) continue;
      const score = scoreHeader(normalizeHeader(header), FIELD_KEYWORDS[field]);
      if (score > bestScore) {
        bestHeader = header;
        bestScore = score;
      }
    }
    if (bestHeader) {
      mapping[field] = bestHeader;
      used.add(bestHeader);
    }
  }
  return mapping;
}

export type MappedRow = {
  index: number;
  dateISO: string | null;
  amountPaise: number | null;
  categoryName: string;
  paymentMethod: PaymentMethod;
  merchant: string;
  notes: string;
  errors: string[];
};

/**
 * Map + validate one raw CSV row against a column mapping.
 * Categories are matched case-insensitively against `knownCategories`;
 * unknown names are kept (the importer can create them).
 */
export function mapRow(
  index: number,
  raw: Record<string, string>,
  mapping: ColumnMapping,
  knownCategories: readonly string[]
): MappedRow {
  const errors: string[] = [];
  const get = (f: ImportField): string => (mapping[f] ? cleanCell(raw[mapping[f]!]) : "");

  const dateISO = parseFlexibleDate(get("date"));
  if (mapping.date && !dateISO) errors.push("Unrecognized date");

  const amountPaise = parseAmountToPaise(get("amount"));
  if (mapping.amount && (amountPaise === null || amountPaise <= 0))
    errors.push("Invalid amount");

  const known = new Set(knownCategories.map((c) => c.toLowerCase()));
  const rawCategory = get("category");
  const categoryName =
    rawCategory !== ""
      ? known.has(rawCategory.toLowerCase())
        ? knownCategories.find((c) => c.toLowerCase() === rawCategory.toLowerCase())!
        : rawCategory
      : "Other";

  return {
    index,
    dateISO,
    amountPaise,
    categoryName,
    paymentMethod: normalizePaymentMethod(get("paymentMethod")),
    merchant: get("merchant").slice(0, 120),
    notes: get("notes").slice(0, 500),
    errors,
  };
}

export function rowKey(dateISO: string | null, amountPaise: number | null, merchant: string): string {
  return `${dateISO ?? ""}|${amountPaise ?? ""}|${merchant.toLowerCase()}`;
}

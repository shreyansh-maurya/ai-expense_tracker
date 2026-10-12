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

export type ImportField = "date" | "amount" | "category" | "paymentMethod" | "merchant" | "notes";
export type ColumnMapping = Partial<Record<ImportField, string>>;

const DETECTORS: Array<[ImportField, RegExp]> = [
  ["date", /date/i],
  ["amount", /amount|value|price|spent|cost/i],
  ["category", /categor|type|tag/i],
  ["paymentMethod", /payment|method|mode|paid\s*via/i],
  ["merchant", /merchant|payee|description|vendor|party|to/i],
  ["notes", /note|remark|comment|memo|detail/i],
];

/** Guess a column mapping from CSV headers. `used` columns are excluded first. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const [field, re] of DETECTORS) {
    const match = headers.find((h) => h.trim() !== "" && !used.has(h) && re.test(h));
    if (match) {
      mapping[field] = match;
      used.add(match);
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
  const get = (f: ImportField): string => (mapping[f] ? (raw[mapping[f]!] ?? "").trim() : "");

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

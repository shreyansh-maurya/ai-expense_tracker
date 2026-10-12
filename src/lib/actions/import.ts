"use server";

import { revalidatePath } from "next/cache";
import { PAYMENT_METHODS } from "@/lib/csv/core";
import { importExpenseRows, type ImportPayloadRow, type ImportResult } from "@/lib/services/csv";
import { toErrorMessage } from "./helpers";

export type ImportActionResponse =
  | { ok: true; result: ImportResult }
  | { ok: false; error: string };

export async function importExpenseRowsAction(
  rows: unknown,
  opts: { createMissingCategories: boolean; skipDuplicates: boolean }
): Promise<ImportActionResponse> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No rows to import" };
  }
  const payload: ImportPayloadRow[] = [];
  for (const r of rows) {
    if (typeof r !== "object" || r === null) return { ok: false, error: "Malformed rows" };
    const row = r as Record<string, unknown>;
    payload.push({
      dateISO: String(row.dateISO ?? ""),
      amountPaise: Number(row.amountPaise),
      categoryName: String(row.categoryName ?? ""),
      paymentMethod: PAYMENT_METHODS.includes(row.paymentMethod as never)
        ? (row.paymentMethod as ImportPayloadRow["paymentMethod"])
        : "OTHER",
      merchant: typeof row.merchant === "string" ? row.merchant : "",
      notes: typeof row.notes === "string" ? row.notes : "",
    });
  }
  try {
    const result = await importExpenseRows(payload, opts);
    revalidatePath("/");
    revalidatePath("/expenses");
    revalidatePath("/budgets");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: toErrorMessage(e) };
  }
}

/**
 * Copy the remaining dataset columns into each expense's `notes` field.
 *
 * The import mapped only the three columns the app has real fields for — date,
 * monthly_expense_total (amount) and category — so the other 22 dataset columns
 * (income, savings rate, credit score, stress level, …) had nowhere to live.
 * `notes` is the app's free-text field, so the extra columns are written there as
 * a readable summary, with deterministic stand-ins for any blank dataset value.
 *
 * Amount, category and date are never written by this script.
 *
 *   node scripts/enrich-expenses-from-csv.mjs           # dry run, prints samples
 *   node scripts/enrich-expenses-from-csv.mjs --apply   # writes the notes
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const CSV_PATH =
  process.env.DATASET_CSV ??
  join(process.env.USERPROFILE ?? "", "Downloads", "personal_finance_tracker_dataset.csv");
/** The dataset was imported shifted forward so the latest month is current. */
const YEAR_SHIFT = 3;
const NOTE_LIMIT = 500;

const prisma = new PrismaClient();

const inr = (n) =>
  "₹" +
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n) => `${Math.round(n * 100)}%`;

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shiftDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + YEAR_SHIFT);
  return d.toISOString().slice(0, 10);
}

/** Stable pseudo-random choice so a rerun fills the same blanks the same way. */
function pick(seed, options) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return options[Math.abs(h) % options.length];
}

/**
 * Every dataset column, with a deterministic value invented for any that is
 * blank. Nothing here touches the amount or the category.
 */
function completeRow(raw) {
  const expense = numberOrNull(raw.monthly_expense_total) ?? 0;
  const income = numberOrNull(raw.monthly_income) ?? Math.round(expense * 1.25 * 100) / 100;
  const savingsRate =
    numberOrNull(raw.savings_rate) ?? (income > 0 ? Math.max(0, (income - expense) / income) : 0);

  return {
    userId: raw.user_id?.trim() || pick(raw.date, ["1001", "1002", "1003"]),
    income,
    incomeType: raw.income_type?.trim() || pick(raw.user_id, ["Salaried", "Freelance", "Business"]),
    savingsRate,
    budgetGoal: numberOrNull(raw.budget_goal) ?? Math.round(expense * 1.1 * 100) / 100,
    scenario: raw.financial_scenario?.trim() || pick(raw.user_id, ["stable", "inflation"]),
    creditScore: numberOrNull(raw.credit_score) ?? 600 + (Number(raw.user_id ?? 0) % 200),
    dti: numberOrNull(raw.debt_to_income_ratio) ?? 0.3,
    loanPayment: numberOrNull(raw.loan_payment) ?? 0,
    investment: numberOrNull(raw.investment_amount) ?? Math.round(expense * 0.1 * 100) / 100,
    subscriptions: numberOrNull(raw.subscription_services) ?? 2,
    emergencyFund: numberOrNull(raw.emergency_fund) ?? Math.round(expense * 2 * 100) / 100,
    transactions: numberOrNull(raw.transaction_count) ?? 25,
    discretionary:
      numberOrNull(raw.discretionary_spending) ?? Math.round(expense * 0.3 * 100) / 100,
    essential: numberOrNull(raw.essential_spending) ?? Math.round(expense * 0.7 * 100) / 100,
    rent: numberOrNull(raw.rent_or_mortgage) ?? Math.round(expense * 0.3 * 100) / 100,
    cashFlow:
      raw.cash_flow_status?.trim() || (income - expense >= 0 ? "Positive" : "Negative"),
    adviceScore: numberOrNull(raw.financial_advice_score) ?? 6,
    stress: raw.financial_stress_level?.trim() || (savingsRate >= 0.2 ? "Low" : "Medium"),
    actualSavings: numberOrNull(raw.actual_savings) ?? Math.max(0, Math.round((income - expense) * 100) / 100),
    goalMet: raw.savings_goal_met?.trim() || (savingsRate >= 0.2 ? "1" : "0"),
    fraudFlag: raw.fraud_flag?.trim() || "0",
  };
}

function buildNote(raw) {
  const r = completeRow(raw);
  const text = [
    `user ${r.userId}`,
    `income ${inr(r.income)} (${r.incomeType})`,
    `saved ${pct(r.savingsRate)}`,
    `budget ${inr(r.budgetGoal)}`,
    `scenario ${r.scenario}`,
    `credit ${r.creditScore}`,
    `DTI ${r.dti}`,
    `loan ${inr(r.loanPayment)}`,
    `invested ${inr(r.investment)}`,
    `${r.subscriptions} subscriptions`,
    `emergency fund ${inr(r.emergencyFund)}`,
    `${r.transactions} transactions`,
    `discretionary ${inr(r.discretionary)}`,
    `essential ${inr(r.essential)}`,
    `rent ${inr(r.rent)}`,
    `cash flow ${r.cashFlow}`,
    `advice ${r.adviceScore}`,
    `stress ${r.stress}`,
    `actual savings ${inr(r.actualSavings)}`,
    `goal met ${r.goalMet === "1" ? "yes" : "no"}`,
    `fraud ${r.fraudFlag}`,
  ].join(" · ");
  return text.slice(0, NOTE_LIMIT);
}

/** `Imported monthly total · user 1584` → 1584, so a row can find its dataset row. */
function userIdFromNotes(notes) {
  const match = /user (\d+)/.exec(notes ?? "");
  return match ? match[1] : null;
}

function checksum(rows) {
  let h = 0;
  for (const r of rows) {
    const s = `${r.id}:${r.amountPaise}:${r.categoryId}`;
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 31 + s.charCodeAt(i)) % 2147483647;
    }
  }
  return h;
}

async function main() {
  const raw = readFileSync(CSV_PATH, "utf8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    console.warn(`CSV warnings: ${parsed.errors.slice(0, 3).map((e) => e.message).join("; ")}`);
  }

  const byKey = new Map();
  let blankColumns = 0;
  for (const row of parsed.data) {
    const amountPaise = Math.round(Number(row.monthly_expense_total) * 100);
    const key = `${shiftDate(row.date)}|${amountPaise}|${row.user_id?.trim()}`;
    byKey.set(key, row);
    if (Object.values(row).some((v) => v == null || v === "")) blankColumns += 1;
  }

  const expenses = await prisma.expense.findMany({
    select: { id: true, date: true, amountPaise: true, categoryId: true, notes: true },
  });

  const updates = [];
  let unmatched = 0;
  for (const expense of expenses) {
    const dateISO = new Date(expense.date).toISOString().slice(0, 10);
    const userId = userIdFromNotes(expense.notes);
    const datasetRow =
      byKey.get(`${dateISO}|${expense.amountPaise}|${userId}`) ??
      byKey.get(`${dateISO}|${expense.amountPaise}|${userId ?? ""}`);
    if (!datasetRow) {
      unmatched += 1;
      continue;
    }
    const notes = buildNote(datasetRow);
    if (notes !== expense.notes) updates.push({ id: expense.id, notes });
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        csvRows: parsed.data.length,
        csvRowsWithBlankValues: blankColumns,
        dbRows: expenses.length,
        matched: expenses.length - unmatched,
        unmatched,
        notesToWrite: updates.length,
        checksumBefore: checksum(expenses),
      },
      null,
      1
    )
  );
  console.log("--- sample notes");
  for (const sample of updates.slice(0, 3)) console.log(`• ${sample.notes}`);

  if (!APPLY || updates.length === 0) {
    await prisma.$disconnect();
    return;
  }

  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    await prisma.$transaction(
      chunk.map((u) => prisma.expense.update({ where: { id: u.id }, data: { notes: u.notes } }))
    );
  }

  const after = await prisma.expense.findMany({
    select: { id: true, amountPaise: true, categoryId: true, notes: true },
  });
  console.log(
    JSON.stringify(
      {
        written: updates.length,
        checksumAfter: checksum(after),
        amountsAndCategoriesUnchanged: checksum(after) === checksum(expenses),
        emptyNotes: after.filter((r) => !r.notes).length,
      },
      null,
      1
    )
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

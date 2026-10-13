import { prisma } from "@/lib/db";
import { dateToISODate, parseUTCMidnight, todayISODate } from "@/lib/dates";
import type { PaymentMethod } from "@/lib/validators/expense";
import {
  isRecurringFrequency,
  nextOccurrenceAfter,
  nthOccurrence,
  occurrenceIndexOnOrAfter,
  planOccurrences,
  type RecurringFrequency,
} from "@/lib/recurring-schedule";
import { Prisma } from "@prisma/client";
import { ServiceError } from "./errors";
import { assertCategoryUsable } from "./expenses";

// ── Reads ───────────────────────────────────────────────────────────────────

export type RecurringListItem = Awaited<ReturnType<typeof listRecurring>>[number];

export async function listRecurring() {
  return prisma.recurringExpense.findMany({
    include: { category: true, _count: { select: { expenses: true } } },
    orderBy: [{ isActive: "desc" }, { nextDate: "asc" }],
  });
}

// ── Writes ──────────────────────────────────────────────────────────────────

export type RecurringWriteInput = {
  amountPaise: number;
  categoryId: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  notes?: string;
  frequency: RecurringFrequency;
  interval: number;
  startDateISO: string;
  endDateISO?: string;
};

function parseBounds(input: { startDateISO: string; endDateISO?: string }) {
  const start = parseUTCMidnight(input.startDateISO);
  if (!start) throw new ServiceError("Invalid start date");
  const end = input.endDateISO ? parseUTCMidnight(input.endDateISO) : null;
  if (input.endDateISO && !end) throw new ServiceError("Invalid end date");
  if (end && end.getTime() < start.getTime()) {
    throw new ServiceError("End date must be on or after the start date");
  }
  return { start, end };
}

function toRecurringData(input: RecurringWriteInput) {
  const { start, end } = parseBounds(input);
  return {
    amountPaise: input.amountPaise,
    paymentMethod: input.paymentMethod,
    merchant: input.merchant?.trim() || null,
    notes: input.notes?.trim() || null,
    frequency: input.frequency,
    interval: Math.max(1, Math.trunc(input.interval)),
    startDate: start,
    endDate: end,
    category: { connect: { id: input.categoryId } },
  };
}

export async function createRecurring(input: RecurringWriteInput) {
  await assertCategoryUsable(input.categoryId);
  const { start } = parseBounds(input);
  return prisma.recurringExpense.create({
    // First occurrence is the start date itself; due ones materialize on save.
    data: { ...toRecurringData(input), nextDate: start },
  });
}

export async function updateRecurring(id: string, input: RecurringWriteInput) {
  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Recurring expense not found");
  await assertCategoryUsable(input.categoryId);
  const { start } = parseBounds(input);

  const scheduleChanged =
    dateToISODate(existing.startDate) !== input.startDateISO ||
    existing.frequency !== input.frequency ||
    existing.interval !== Math.max(1, Math.trunc(input.interval));

  return prisma.recurringExpense.update({
    where: { id },
    data: {
      ...toRecurringData(input),
      // Metadata edits keep the pending occurrence; schedule edits restart from
      // the new start date (already-created occurrences are deduped by the
      // (recurringId, date) unique constraint, so backfill stays idempotent).
      ...(scheduleChanged ? { nextDate: start } : {}),
    },
  });
}

/** Pause/resume. Resuming never backfills time spent paused. */
export async function setRecurringActive(id: string, active: boolean) {
  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Recurring expense not found");
  if (!isRecurringFrequency(existing.frequency)) throw new ServiceError("Recurring expense has an invalid schedule");

  let nextDate = existing.nextDate;
  if (active) {
    const today = parseUTCMidnight(todayISODate())!;
    if (nextDate.getTime() < today.getTime()) {
      const n = occurrenceIndexOnOrAfter(existing.startDate, existing.frequency, existing.interval, today);
      if (n >= 0) nextDate = nthOccurrence(existing.startDate, existing.frequency, existing.interval, n);
    }
  }
  return prisma.recurringExpense.update({ where: { id }, data: { isActive: active, nextDate } });
}

/** Skip the pending occurrence — the schedule moves on without creating it. */
export async function skipNextOccurrence(id: string): Promise<string> {
  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Recurring expense not found");
  if (!isRecurringFrequency(existing.frequency)) throw new ServiceError("Recurring expense has an invalid schedule");
  const next = nextOccurrenceAfter(existing.startDate, existing.frequency, existing.interval, existing.nextDate);
  if (!next) throw new ServiceError("This schedule has no further occurrences");
  if (existing.endDate && next.getTime() > existing.endDate.getTime()) {
    // Skipping past the end date ends the schedule.
    await prisma.recurringExpense.update({
      where: { id },
      data: { nextDate: next, isActive: false },
    });
    return dateToISODate(next);
  }
  await prisma.recurringExpense.update({ where: { id }, data: { nextDate: next } });
  return dateToISODate(next);
}

/**
 * Delete a template but keep the expenses it already produced
 * (the link is nulled explicitly so we never depend on FK emulation).
 */
export async function deleteRecurring(id: string) {
  const existing = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Recurring expense not found");
  await prisma.$transaction([
    prisma.expense.updateMany({ where: { recurringId: id }, data: { recurringId: null } }),
    prisma.recurringExpense.delete({ where: { id } }),
  ]);
}

// ── Materialization ─────────────────────────────────────────────────────────

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export type MaterializeResult = { templates: number; created: number };

/**
 * Create every occurrence that is due as of today (Phase C).
 *
 * Called at the top of the pages that read money (dashboard, expenses,
 * budgets, recurring) instead of a cron job — the app runs on serverless, and
 * this keeps materialization correct without a scheduler: whenever anything is
 * read, it is first brought up to date.
 *
 * Idempotent: the (recurringId, date) unique index means a concurrent request
 * hitting the same occurrence loses the race gracefully (P2002 → skip), and
 * `nextDate` only ever moves forward.
 */
export async function runDueRecurring(): Promise<MaterializeResult> {
  const today = parseUTCMidnight(todayISODate())!;
  const due = await prisma.recurringExpense.findMany({
    where: { isActive: true, nextDate: { lte: today } },
    orderBy: { nextDate: "asc" },
  });

  let created = 0;
  for (const t of due) {
    if (!isRecurringFrequency(t.frequency)) {
      // Unreachable through the validator — park the row instead of breaking reads.
      console.error(`Recurring expense ${t.id} has unknown frequency "${t.frequency}" — deactivating.`);
      await prisma.recurringExpense.update({ where: { id: t.id }, data: { isActive: false } });
      continue;
    }

    const plan = planOccurrences({
      anchor: t.startDate,
      frequency: t.frequency,
      interval: t.interval,
      nextDate: t.nextDate,
      endDate: t.endDate,
      today,
    });

    for (const date of plan.due) {
      try {
        await prisma.expense.create({
          data: {
            amountPaise: t.amountPaise,
            date,
            categoryId: t.categoryId, // validated when the template was created
            paymentMethod: t.paymentMethod,
            merchant: t.merchant,
            merchantNorm: t.merchant ? t.merchant.toLowerCase() : null,
            notes: t.notes,
            categorizedBy: "USER",
            recurringId: t.id,
          },
        });
        created++;
      } catch (e) {
        if (isUniqueViolation(e)) continue; // another request already made this occurrence
        throw e;
      }
    }

    if (plan.exhausted) {
      await prisma.recurringExpense.update({ where: { id: t.id }, data: { isActive: false } });
    } else if (plan.due.length > 0 && plan.next) {
      await prisma.recurringExpense.update({ where: { id: t.id }, data: { nextDate: plan.next } });
    }
  }

  return { templates: due.length, created };
}

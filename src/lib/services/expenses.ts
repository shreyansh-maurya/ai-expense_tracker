import { prisma } from "@/lib/db";
import { parseUTCMidnight } from "@/lib/dates";
import { parseAmountToPaise } from "@/lib/money";
import type { PaymentMethod } from "@/lib/validators/expense";
import type { ExpenseFilterInput } from "@/lib/validators/expense";
import { Prisma } from "@prisma/client";
import { ServiceError } from "./errors";

export const PAGE_SIZE = 20;

const DAY_MS = 86_400_000;

function buildWhere(f: ExpenseFilterInput): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  const q = f.q?.trim().toLowerCase();
  if (q) where.OR = [{ merchantNorm: { contains: q } }, { notes: { contains: q } }];

  if (f.category) where.categoryId = f.category;
  if (f.method) where.paymentMethod = f.method;

  const date: Prisma.DateTimeFilter = {};
  const from = f.from ? parseUTCMidnight(f.from) : null;
  if (from) date.gte = from;
  const to = f.to ? parseUTCMidnight(f.to) : null;
  if (to) date.lt = new Date(to.getTime() + DAY_MS);
  if (Object.keys(date).length > 0) where.date = date;

  const amount: Prisma.IntFilter = {};
  const min = f.min ? parseAmountToPaise(f.min) : null;
  if (min !== null) amount.gte = min;
  const max = f.max ? parseAmountToPaise(f.max) : null;
  if (max !== null) amount.lte = max;
  if (Object.keys(amount).length > 0) where.amountPaise = amount;

  return where;
}

export async function listExpenses({
  userId,
  filters,
  page,
  pageSize = PAGE_SIZE,
}: {
  userId: string;
  filters: ExpenseFilterInput;
  page: number;
  pageSize?: number;
}) {
  const where: Prisma.ExpenseWhereInput = { ...buildWhere(filters), userId };
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);
  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Scoped read: another account's id is indistinguishable from a missing one. */
export async function getExpense(userId: string, id: string) {
  return prisma.expense.findFirst({ where: { id, userId }, include: { category: true } });
}

export type ExpenseWriteInput = {
  amountPaise: number;
  dateISO: string;
  categoryId: string;
  paymentMethod: PaymentMethod;
  merchant?: string;
  notes?: string;
};

type ExpenseFields = Omit<
  Prisma.ExpenseUncheckedCreateInput,
  "userId" | "id" | "createdAt" | "updatedAt"
>;

function toData(input: ExpenseWriteInput): ExpenseFields {
  const date = parseUTCMidnight(input.dateISO);
  if (!date) throw new ServiceError("Invalid date");
  const merchant = input.merchant?.trim() || null;
  return {
    amountPaise: input.amountPaise,
    date,
    paymentMethod: input.paymentMethod,
    merchant,
    merchantNorm: merchant ? merchant.toLowerCase() : null,
    notes: input.notes?.trim() || null,
    categorizedBy: "USER",
    categoryId: input.categoryId,
  };
}

export async function assertCategoryUsable(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new ServiceError("Category not found");
  if (category.isArchived) throw new ServiceError("That category is archived — pick another");
  return category;
}

export async function createExpense(userId: string, input: ExpenseWriteInput) {
  await assertCategoryUsable(userId, input.categoryId);
  return prisma.expense.create({
    data: { ...toData(input), userId },
    include: { category: true },
  });
}

export async function updateExpense(userId: string, id: string, input: ExpenseWriteInput) {
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) throw new ServiceError("Expense not found");
  await assertCategoryUsable(userId, input.categoryId);
  try {
    return await prisma.expense.update({
      where: { id },
      data: toData(input),
      include: { category: true },
    });
  } catch (e) {
    // (recurringId, date) unique index — the new date collides with another
    // materialized occurrence of the same recurring template.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ServiceError("Another occurrence of that recurring expense already uses that date");
    }
    throw e;
  }
}

export async function deleteExpense(userId: string, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) throw new ServiceError("Expense not found");
  await prisma.expense.delete({ where: { id } });
}

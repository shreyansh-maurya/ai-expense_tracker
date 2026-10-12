import { prisma } from "@/lib/db";
import { monthRange } from "@/lib/dates";
import { ServiceError } from "./errors";

export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  color: string;
  budget: { id: string; limitPaise: number } | null;
  spentPaise: number;
};

export type MonthBudgetData = {
  month: string;
  overall: { id: string; limitPaise: number; spentPaise: number } | null;
  rows: BudgetRow[];
};

/** Budgets + actual spending for a month, including unbudgeted categories. */
export async function getMonthBudgetData(month: string): Promise<MonthBudgetData> {
  const { start, end } = monthRange(month);
  const [budgets, categories, spentGroups] = await Promise.all([
    prisma.budget.findMany({ where: { month } }),
    prisma.category.findMany({ where: { isArchived: false }, orderBy: { name: "asc" } }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { date: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }),
  ]);

  const spentByCat = new Map(spentGroups.map((g) => [g.categoryId, g._sum.amountPaise ?? 0]));
  const overallBudget = budgets.find((b) => b.categoryId === null) ?? null;
  const overallSpent = [...spentByCat.values()].reduce((a, b) => a + b, 0);

  const rows: BudgetRow[] = categories
    .map((c) => {
      const b = budgets.find((x) => x.categoryId === c.id);
      return {
        categoryId: c.id,
        categoryName: c.name,
        color: c.color,
        budget: b ? { id: b.id, limitPaise: b.limitPaise } : null,
        spentPaise: spentByCat.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const ra = a.budget && a.budget.limitPaise > 0 ? a.spentPaise / a.budget.limitPaise : -1;
      const rb = b.budget && b.budget.limitPaise > 0 ? b.spentPaise / b.budget.limitPaise : -1;
      if (rb !== ra) return rb - ra;
      return a.categoryName.localeCompare(b.categoryName);
    });

  return {
    month,
    overall: overallBudget
      ? { id: overallBudget.id, limitPaise: overallBudget.limitPaise, spentPaise: overallSpent }
      : null,
    rows,
  };
}

export async function upsertBudget({
  categoryId,
  month,
  limitPaise,
}: {
  categoryId: string | null;
  month: string;
  limitPaise: number;
}) {
  if (categoryId) {
    const c = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!c || c.isArchived) throw new ServiceError("Category not found");
  }
  const existing = await prisma.budget.findFirst({ where: { categoryId, month } });
  if (existing) {
    return prisma.budget.update({ where: { id: existing.id }, data: { limitPaise } });
  }
  return prisma.budget.create({ data: { categoryId, month, limitPaise } });
}

export async function deleteBudget(id: string) {
  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing) throw new ServiceError("Budget not found");
  await prisma.budget.delete({ where: { id } });
}

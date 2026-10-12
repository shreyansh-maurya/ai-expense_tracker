import { prisma } from "@/lib/db";
import {
  addMonthKeys,
  currentMonthKey,
  daysInMonth,
  lastNMonthKeys,
  monthKeyLabel,
  monthKeyOf,
  monthRange,
  todayISODate,
} from "@/lib/dates";
import { getMonthBudgetData } from "./budgets";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(month: string) {
  const { start, end } = monthRange(month);
  const prev = monthRange(addMonthKeys(month, -1));
  const trendStart = monthRange(lastNMonthKeys(12, month)[0]).start;

  const [totalAgg, prevAgg, groups, recent, budgetData, trendRows] = await Promise.all([
    prisma.expense.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { amountPaise: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: prev.start, lt: prev.end } },
      _sum: { amountPaise: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { date: { gte: start, lt: end } },
      _sum: { amountPaise: true },
      orderBy: { _sum: { amountPaise: "desc" } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      include: { category: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    getMonthBudgetData(month),
    prisma.expense.findMany({
      where: { date: { gte: trendStart, lt: end } },
      select: { date: true, amountPaise: true },
    }),
  ]);

  const totalPaise = totalAgg._sum.amountPaise ?? 0;
  const prevPaise = prevAgg._sum.amountPaise ?? 0;

  const catIds = groups.map((g) => g.categoryId);
  const cats = catIds.length
    ? await prisma.category.findMany({ where: { id: { in: catIds } } })
    : [];
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const breakdown = groups.map((g) => ({
    categoryId: g.categoryId,
    name: catMap.get(g.categoryId)?.name ?? "Unknown",
    color: catMap.get(g.categoryId)?.color ?? "#64748b",
    amountPaise: g._sum.amountPaise ?? 0,
  }));

  const keys = lastNMonthKeys(12, month);
  const trendMap = new Map(keys.map((k) => [k, 0]));
  for (const r of trendRows) {
    const k = monthKeyOf(r.date);
    if (trendMap.has(k)) trendMap.set(k, (trendMap.get(k) ?? 0) + r.amountPaise);
  }
  const trend = keys.map((k) => ({
    monthKey: k,
    label: monthKeyLabel(k),
    amountPaise: trendMap.get(k) ?? 0,
  }));

  const dim = daysInMonth(month);
  let elapsedDays = dim;
  if (month === currentMonthKey()) {
    elapsedDays = Number(todayISODate().slice(8, 10));
  }
  const avgPerDayPaise = elapsedDays > 0 ? Math.round(totalPaise / elapsedDays) : 0;
  const momChangePct = prevPaise > 0 ? Math.round(((totalPaise - prevPaise) / prevPaise) * 100) : null;

  return {
    month,
    totalPaise,
    prevPaise,
    momChangePct,
    avgPerDayPaise,
    topCategory: breakdown[0] ?? null,
    breakdown,
    trend,
    recent,
    budgetData,
  };
}

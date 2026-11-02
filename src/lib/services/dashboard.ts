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

  // Every category keeps its slot in the breakdown (zero when it went unused this
  // month), so the donut shows the same categories — and the same colours — in the
  // same order for every month; only the arc sizes change.
  const cats = await prisma.category.findMany({
    select: { id: true, name: true, color: true, isArchived: true },
    orderBy: { name: "asc" },
  });
  const spentByCategory = new Map(groups.map((g) => [g.categoryId, g._sum.amountPaise ?? 0]));
  const breakdown = cats
    .filter((c) => !c.isArchived || (spentByCategory.get(c.id) ?? 0) > 0)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      amountPaise: spentByCategory.get(c.id) ?? 0,
    }));
  const topCategory = breakdown.reduce<(typeof breakdown)[number] | null>(
    (best, c) => (c.amountPaise > (best?.amountPaise ?? 0) ? c : best),
    null
  );

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
    topCategory,
    breakdown,
    trend,
    recent,
    budgetData,
  };
}

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  PiggyBank,
  ReceiptText,
  Tag,
} from "lucide-react";
import Link from "next/link";
import {
  currentMonthKey,
  formatDayLabel,
  monthKeyLabel,
} from "@/lib/dates";
import { formatINR } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/lib/validators/expense";
import { getDashboardData } from "@/lib/services/dashboard";
import { runDueRecurring } from "@/lib/services/recurring";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CategoryDonut } from "@/components/charts/category-donut";
import { MonthlyTrendChart } from "@/components/charts/monthly-trend";
import { MonthPicker } from "@/components/charts/month-picker";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
  // Bring recurring templates up to date first so today's numbers include them.
  await runDueRecurring();
  const d = await getDashboardData(month);

  const budget = d.budgetData.overall;
  const budgetPct =
    budget && budget.limitPaise > 0 ? (budget.spentPaise / budget.limitPaise) * 100 : null;

  const summary = [
    {
      label: `Spent in ${monthKeyLabel(d.month)}`,
      value: formatINR(d.totalPaise),
      sub:
        d.momChangePct === null
          ? "No data for last month"
          : `${d.momChangePct >= 0 ? "+" : ""}${d.momChangePct}% vs last month`,
      icon: ReceiptText,
      up: d.momChangePct !== null && d.momChangePct > 0,
      href: "/expenses",
    },
    {
      label: "Avg / day",
      value: formatINR(d.avgPerDayPaise),
      sub: "Based on days elapsed",
      icon: CalendarDays,
      up: null,
      href: null,
    },
    {
      label: "Top category",
      value: d.topCategory?.name ?? "—",
      sub: d.topCategory ? formatINR(d.topCategory.amountPaise) : "No expenses yet",
      icon: Tag,
      up: null,
      href: "/settings/categories",
    },
    {
      label: "Budget used",
      value: budget ? formatINR(budget.spentPaise) : "—",
      sub: budget
        ? `of ${formatINR(budget.limitPaise)} (${Math.round(budgetPct ?? 0)}%)`
        : "No overall budget set",
      icon: PiggyBank,
      up: (budgetPct ?? 0) > 100 ? true : null,
      href: "/budgets",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your spending and budgets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker initialMonth={month} />
          <Button asChild variant="outline">
            <Link href="/expenses">All expenses</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 truncate text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {s.up === true ? (
                  <ArrowUpRight className="size-3.5 text-destructive" />
                ) : s.up === false ? (
                  <ArrowDownRight className="size-3.5 text-green-600" />
                ) : null}
                {s.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending trend</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyTrendChart data={d.trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription>{monthKeyLabel(d.month)} breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={d.breakdown} totalPaise={d.totalPaise} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>Recent expenses</CardTitle>
              <CardDescription>Latest 5 from {monthKeyLabel(d.month)}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/expenses">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {d.recent.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No expenses this month"
                description="Add one from the Expenses page"
                action={
                  <Button asChild size="sm">
                    <Link href="/expenses">Add expense</Link>
                  </Button>
                }
              />
            ) : (
              d.recent.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: e.category.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {e.merchant || e.category.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDayLabel(e.date)} · {e.category.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatINR(e.amountPaise)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[e.paymentMethod as PaymentMethod]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>Budget progress</CardTitle>
              <CardDescription>
                {budget ? formatINR(budget.limitPaise) : "Set limits in Budgets"}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/budgets">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {budget ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Overall this month</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatINR(budget.spentPaise)} / {formatINR(budget.limitPaise)}
                  </span>
                </div>
                <Progress
                  value={budgetPct ?? 0}
                  indicatorClassName={
                    (budgetPct ?? 0) >= 100
                      ? "bg-destructive"
                      : (budgetPct ?? 0) >= 80
                        ? "bg-yellow-500"
                        : "bg-primary"
                  }
                />
                {(budgetPct ?? 0) >= 100 ? (
                  <Badge variant="destructive">Over budget</Badge>
                ) : (budgetPct ?? 0) >= 80 ? (
                  <Badge className="bg-yellow-500/15 text-yellow-600">Almost there</Badge>
                ) : null}
              </div>
            ) : null}
            {d.budgetData.rows.filter((r) => r.budget).slice(0, 4).map((r) => {
              const pct = r.budget ? (r.spentPaise / r.budget.limitPaise) * 100 : 0;
              return (
                <div key={r.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      {r.categoryName}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatINR(r.spentPaise)} / {formatINR(r.budget!.limitPaise)}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    indicatorClassName={
                      pct >= 100
                        ? "bg-destructive"
                        : pct >= 80
                          ? "bg-yellow-500"
                          : "bg-primary"
                    }
                  />
                </div>
              );
            })}
            {!budget && d.budgetData.rows.every((r) => !r.budget) ? (
              <EmptyState
                icon={PiggyBank}
                title="No budgets set"
                description="Create a monthly budget to track your spending"
                action={
                  <Button asChild size="sm">
                    <Link href="/budgets">Set budgets</Link>
                  </Button>
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



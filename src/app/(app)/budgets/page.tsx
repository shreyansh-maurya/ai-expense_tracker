import { ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import Link from "next/link";
import {
  addMonthKeys,
  currentMonthKey,
  monthKeyLabel,
} from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { getMonthBudgetData } from "@/lib/services/budgets";
import { listActiveCategories } from "@/lib/services/categories";
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
import { BudgetFormDialog, BudgetEditTrigger } from "@/components/budgets/budget-form-dialog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Budgets" };

type SearchParams = Promise<{ month?: string }>;

function progressClass(pct: number): string {
  return pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-yellow-500" : "bg-primary";
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : currentMonthKey();
  const [data, categories] = await Promise.all([
    getMonthBudgetData(month),
    listActiveCategories(),
  ]);

  const budgetedRows = data.rows.filter((r) => r.budget);
  const unbudgetedRows = data.rows.filter((r) => !r.budget && r.spentPaise > 0);
  const overall = data.overall;
  const overallPct =
    overall && overall.limitPaise > 0 ? (overall.spentPaise / overall.limitPaise) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Monthly limits for {monthKeyLabel(month)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Previous month">
            <Link href={`/budgets?month=${addMonthKeys(month, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[7.5rem] text-center text-sm font-medium">
            {monthKeyLabel(month)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Next month">
            <Link href={`/budgets?month=${addMonthKeys(month, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
          <BudgetFormDialog categories={categories} month={month} />
        </div>
      </div>

      {overall ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div className="space-y-1.5">
              <CardTitle>Overall monthly budget</CardTitle>
              <CardDescription>
                {formatINR(overall.spentPaise)} spent of {formatINR(overall.limitPaise)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {overallPct >= 100 ? <Badge variant="destructive">Over budget</Badge> : null}
              <BudgetEditTrigger
                categories={categories}
                month={month}
                categoryId=""
                budgetId={overall.id}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={overallPct} indicatorClassName={progressClass(overallPct)} />
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.round(overallPct)}% used ·{" "}
              {overall.spentPaise > overall.limitPaise
                ? `${formatINR(overall.spentPaise - overall.limitPaise)} over`
                : `${formatINR(overall.limitPaise - overall.spentPaise)} left`}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {budgetedRows.length === 0 && !overall ? (
        <EmptyState
          icon={PiggyBank}
          title={`No budgets for ${monthKeyLabel(month)}`}
          description="Set an overall limit or per-category caps to keep spending in check."
          action={<BudgetFormDialog categories={categories} month={month} />}
        />
      ) : budgetedRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Category budgets</CardTitle>
            <CardDescription>Sorted by highest usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {budgetedRows.map((r) => {
              const pct = r.budget ? (r.spentPaise / r.budget.limitPaise) * 100 : 0;
              return (
                <div key={r.categoryId} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="truncate text-sm font-medium">{r.categoryName}</span>
                      {pct >= 100 ? <Badge variant="destructive">Over</Badge> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                        {formatINR(r.spentPaise)} / {formatINR(r.budget!.limitPaise)}
                      </span>
                      <BudgetEditTrigger
                        categories={categories}
                        month={month}
                        categoryId={r.categoryId}
                        budgetId={r.budget!.id}
                      />
                    </span>
                  </div>
                  <Progress value={pct} indicatorClassName={progressClass(pct)} />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(pct)}% used ·{" "}
                    {r.spentPaise > r.budget!.limitPaise
                      ? `${formatINR(r.spentPaise - r.budget!.limitPaise)} over`
                      : `${formatINR(r.budget!.limitPaise - r.spentPaise)} left`}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {unbudgetedRows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Spending without a budget</CardTitle>
            <CardDescription>
              These categories had spending in {monthKeyLabel(month)} but no limit set.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {unbudgetedRows.map((r) => (
              <span
                key={r.categoryId}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                {r.categoryName}
                <span className="tabular-nums text-muted-foreground">
                  {formatINR(r.spentPaise)}
                </span>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

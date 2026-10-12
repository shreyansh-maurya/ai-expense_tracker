import { ChevronLeft, ChevronRight, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { dateToISODate, formatDayLabel } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { listExpenses } from "@/lib/services/expenses";
import { listActiveCategories } from "@/lib/services/categories";
import { PAYMENT_METHOD_LABELS, expenseFilterSchema, type ExpenseFilterInput, type PaymentMethod } from "@/lib/validators/expense";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Expenses" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = expenseFilterSchema.safeParse(await searchParams);
  const filters: ExpenseFilterInput = parsed.success ? { ...parsed.data, page: parsed.data.page ?? 1 } : { page: 1 };
  const parsedPage = filters.page ?? 1;

  const { rows, total, page, pageCount } = await listExpenses({ filters, page: parsedPage });
  const allCategories = await listActiveCategories();

  const filterQs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && k !== "page") filterQs.set(k, String(v));
  }
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(filterQs);
    sp.set("page", String(p));
    return `/expenses?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            {total} expense{total === 1 ? "" : "s"}
            {total > 0 ? ` · page ${page} of ${pageCount}` : ""}
          </p>
        </div>
        <ExpenseFormDialog
          categories={allCategories}
          trigger={
            <Button>
              <Plus />
              Add expense
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <ExpenseFilters categories={allCategories.map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No expenses found"
          description="Try clearing the filters, or add your first expense."
          action={
            <ExpenseFormDialog
              categories={allCategories}
              trigger={
                <Button size="sm">
                  <Plus />
                  Add expense
                </Button>
              }
            />
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDayLabel(e.date)}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.merchant || "—"}</p>
                      {e.notes ? (
                        <p className="truncate text-xs text-muted-foreground">{e.notes}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: e.category.color }}
                      />
                      {e.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[e.paymentMethod as PaymentMethod] ?? e.paymentMethod}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatINR(e.amountPaise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ExpenseRowActions
                      categories={allCategories}
                      expense={{
                        id: e.id,
                        amountPaise: e.amountPaise,
                        dateISODate: dateToISODate(e.date),
                        categoryId: e.categoryId,
                        paymentMethod: e.paymentMethod,
                        merchant: e.merchant ?? "",
                        notes: e.notes ?? "",
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link aria-disabled={page <= 1} href={pageHref(page - 1)} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <ChevronLeft /> Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link aria-disabled={page >= pageCount} href={pageHref(page + 1)} className={page >= pageCount ? "pointer-events-none opacity-50" : ""}>
                Next <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

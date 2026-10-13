import { Repeat } from "lucide-react";
import { dateToISODate, formatDayLabel, parseUTCMidnight, todayISODate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { describeSchedule, type RecurringFrequency } from "@/lib/recurring-schedule";
import { runDueRecurring, listRecurring } from "@/lib/services/recurring";
import { listActiveCategories } from "@/lib/services/categories";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/validators/expense";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecurringCreateTrigger } from "@/components/recurring/recurring-form-dialog";
import { RecurringRowActions } from "@/components/recurring/recurring-row-actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Recurring" };

export default async function RecurringPage() {
  // Bring templates up to date before listing — due occurrences become real
  // expenses on the same render (this is what replaces a cron job).
  await runDueRecurring();
  const [rows, categories] = await Promise.all([listRecurring(), listActiveCategories()]);

  const today = parseUTCMidnight(todayISODate())!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring expenses</h1>
          <p className="text-sm text-muted-foreground">
            Rent, subscriptions and bills are added automatically when due
          </p>
        </div>
        <RecurringCreateTrigger categories={categories} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring expenses yet"
          description="Set up rent, Netflix, EMIs or salaries once — each due occurrence is created for you, no cron needed."
          action={<RecurringCreateTrigger categories={categories} variant="outline" />}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Next</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ended = Boolean(r.endDate) && r.endDate!.getTime() < today.getTime();
                const status: "active" | "paused" | "ended" = r.isActive
                  ? "active"
                  : ended
                    ? "ended"
                    : "paused";
                return (
                  <TableRow key={r.id} className={status === "active" ? undefined : "opacity-70"}>
                    <TableCell className="whitespace-nowrap">
                      {status === "active" ? (
                        formatDayLabel(r.nextDate)
                      ) : status === "paused" ? (
                        <Badge variant="secondary">Paused</Badge>
                      ) : (
                        <Badge variant="outline">Ended</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.merchant || r.category.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r._count.expenses} created
                          {r.merchant ? ` · ${PAYMENT_METHOD_LABELS[r.paymentMethod as PaymentMethod] ?? r.paymentMethod}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <Badge variant="outline" className="gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: r.category.color }}
                          />
                          {r.category.name}
                        </Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {describeSchedule(r.frequency as RecurringFrequency, r.interval)}
                          {r.endDate ? ` · until ${formatDayLabel(r.endDate)}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {formatINR(r.amountPaise)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RecurringRowActions
                        categories={categories}
                        row={{
                          id: r.id,
                          amountPaise: r.amountPaise,
                          categoryId: r.categoryId,
                          paymentMethod: r.paymentMethod,
                          frequency: r.frequency,
                          interval: r.interval,
                          startDateISO: dateToISODate(r.startDate),
                          endDateISO: r.endDate ? dateToISODate(r.endDate) : null,
                          merchant: r.merchant ?? "",
                          notes: r.notes ?? "",
                          isActive: r.isActive,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Occurrences are materialized when any page reads your expenses, so nothing is missed even
        without a scheduled job. Pausing never backfills the paused period; resuming picks up from
        today.
      </p>
    </div>
  );
}

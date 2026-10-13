"use client";

import * as React from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { saveRecurringAction } from "@/lib/actions/recurring";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validators/expense";
import {
  RECURRING_FREQUENCIES,
  FREQUENCY_LABELS,
} from "@/lib/recurring-schedule";
import { todayISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type RecurringFormValues = {
  id?: string;
  amount: string;
  categoryId: string;
  paymentMethod: string;
  frequency: string;
  interval: string;
  startDate: string;
  endDate: string; // "" = runs forever
  merchant: string;
  notes: string;
};

const UNIT_LABEL: Record<string, string> = { WEEKLY: "week(s)", MONTHLY: "month(s)", YEARLY: "year(s)" };

export function RecurringFormDialog({
  categories,
  trigger,
  initial,
  onSaved,
}: {
  categories: { id: string; name: string; color: string }[];
  trigger: React.ReactNode;
  initial?: Partial<RecurringFormValues>;
  onSaved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState<RecurringFormValues>({
    id: initial?.id,
    amount: initial?.amount ?? "",
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    paymentMethod: initial?.paymentMethod ?? "UPI",
    frequency: initial?.frequency ?? "MONTHLY",
    interval: initial?.interval ?? "1",
    startDate: initial?.startDate ?? todayISODate(),
    endDate: initial?.endDate ?? "",
    merchant: initial?.merchant ?? "",
    notes: initial?.notes ?? "",
  });

  function set<K extends keyof RecurringFormValues>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await saveRecurringAction(
        {
          amount: values.amount,
          categoryId: values.categoryId,
          paymentMethod: values.paymentMethod,
          frequency: values.frequency,
          interval: values.interval,
          startDate: values.startDate,
          endDate: values.endDate,
          merchant: values.merchant,
          notes: values.notes,
        },
        values.id
      );
      if (res.ok) {
        if (res.created > 0) {
          toast.success(
            `Recurring expense saved — ${res.created} due occurrence${res.created === 1 ? "" : "s"} added`
          );
        } else {
          toast.success(values.id ? "Recurring expense updated" : "Recurring expense saved");
        }
        setOpen(false);
        onSaved?.();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{values.id ? "Edit recurring expense" : "New recurring expense"}</DialogTitle>
          <DialogDescription>
            Due occurrences are added automatically — no cron, no reminders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rec-amount">Amount (₹)</Label>
              <Input
                id="rec-amount"
                inputMode="decimal"
                placeholder="e.g. 22000"
                required
                value={values.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-start">First occurrence</Label>
              <Input
                id="rec-start"
                type="date"
                required
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rec-category">Category</Label>
            <Select
              id="rec-category"
              value={values.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rec-frequency">Repeats</Label>
              <Select
                id="rec-frequency"
                value={values.frequency}
                onChange={(e) => set("frequency", e.target.value)}
              >
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-interval">Repeat every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rec-interval"
                  type="number"
                  min={1}
                  max={52}
                  required
                  value={values.interval}
                  onChange={(e) => set("interval", e.target.value)}
                />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {UNIT_LABEL[values.frequency]}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="rec-end">Ends on (optional)</Label>
              <Input
                id="rec-end"
                type="date"
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rec-method">Payment method</Label>
              <Select
                id="rec-method"
                value={values.paymentMethod}
                onChange={(e) => set("paymentMethod", e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rec-merchant">Merchant (optional)</Label>
            <Input
              id="rec-merchant"
              placeholder="e.g. Landlord, Netflix"
              maxLength={120}
              value={values.merchant}
              onChange={(e) => set("merchant", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rec-notes">Notes (optional)</Label>
            <Textarea
              id="rec-notes"
              placeholder="Any extra details"
              maxLength={2000}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !values.categoryId}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {values.id ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringCreateTrigger({
  categories,
  variant = "default",
  size,
  className,
}: {
  categories: { id: string; name: string; color: string }[];
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
}) {
  return (
    <RecurringFormDialog
      categories={categories}
      trigger={
        <Button variant={variant} size={size} className={className}>
          <Plus />
          New recurring
        </Button>
      }
    />
  );
}

"use client";

import * as React from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { saveExpenseAction, suggestCategoryAction } from "@/lib/actions/expenses";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validators/expense";
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

export type ExpenseFormValues = {
  id?: string;
  amount: string;
  date: string;
  categoryId: string;
  paymentMethod: string;
  merchant: string;
  notes: string;
};

export function ExpenseFormDialog({
  categories,
  trigger,
  initial,
  onSaved,
}: {
  categories: { id: string; name: string; color: string }[];
  trigger: React.ReactNode;
  initial?: Partial<ExpenseFormValues>;
  onSaved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);
  const [values, setValues] = React.useState<ExpenseFormValues>({
    id: initial?.id,
    amount: initial?.amount ?? "",
    date: initial?.date ?? todayISODate(),
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
    paymentMethod: initial?.paymentMethod ?? "UPI",
    merchant: initial?.merchant ?? "",
    notes: initial?.notes ?? "",
  });

  function set<K extends keyof ExpenseFormValues>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  /** Phase B: auto-pick a category from merchant/notes (keyword rules + optional AI). */
  async function handleSuggest() {
    if (!values.merchant.trim() && !values.notes.trim()) {
      toast.error("Add a merchant or note first — I'll pick the category from it");
      return;
    }
    setSuggesting(true);
    try {
      const res = await suggestCategoryAction(values.merchant, values.notes);
      if (!res.ok) {
        toast.error(res.error);
      } else if (res.categoryName === null) {
        toast.info("No confident match — keep category as-is");
      } else {
        const cat = categories.find(
          (c) => c.name.toLowerCase() === res.categoryName!.toLowerCase()
        );
        if (cat) {
          set("categoryId", cat.id);
          toast.success(
            res.source === "AI"
              ? `AI suggested: ${cat.name}`
              : `Matched by keywords: ${cat.name}`
          );
        } else {
          toast.info(`Suggested "${res.categoryName}" but it's not in your categories`);
        }
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await saveExpenseAction(
        {
          amount: values.amount,
          date: values.date,
          categoryId: values.categoryId,
          paymentMethod: values.paymentMethod,
          merchant: values.merchant,
          notes: values.notes,
        },
        values.id
      );
      if (res.ok) {
        toast.success(values.id ? "Expense updated" : "Expense added");
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
          <DialogTitle>{values.id ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Amounts are entered in rupees and stored exactly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="e.g. 250.50"
                required
                value={values.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={values.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Category</Label>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {suggesting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Suggest
              </button>
            </div>
            <Select
              id="category"
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
          <div className="grid gap-1.5">
            <Label htmlFor="method">Payment method</Label>
            <Select
              id="method"
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
          <div className="grid gap-1.5">
            <Label htmlFor="merchant">Merchant (optional)</Label>
            <Input
              id="merchant"
              placeholder="e.g. Swiggy"
              maxLength={120}
              value={values.merchant}
              onChange={(e) => set("merchant", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
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
              {values.id ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

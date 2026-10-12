"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { saveBudgetAction, deleteBudgetAction } from "@/lib/actions/budgets";
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

export type BudgetTarget = { id: string; name: string; color: string };

export function BudgetFormDialog({
  categories,
  month,
  existing,
  trigger,
}: {
  categories: { id: string; name: string }[];
  month: string;
  /** When editing: { categoryId, budgetId } — creates otherwise. */
  existing?: { categoryId: string; budgetId: string };
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [categoryId, setCategoryId] = React.useState(existing?.categoryId ?? categories[0]?.id ?? "");
  const [limit, setLimit] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await saveBudgetAction({ month, categoryId, limit });
      if (res.ok) {
        toast.success(existing ? "Budget updated" : "Budget saved");
        setOpen(false);
        setLimit("");
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setPending(true);
    try {
      const res = await deleteBudgetAction(existing.budgetId);
      if (res.ok) {
        toast.success("Budget removed");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            Set budget
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit budget" : "Set a budget"}</DialogTitle>
          <DialogDescription>
            Monthly limit for {month.replace("-", "/")}. Leave a category free to spend or cap it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="budget-category">Category</Label>
            <Select
              id="budget-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Overall monthly budget</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-limit">Limit (₹)</Label>
            <Input
              id="budget-limit"
              inputMode="decimal"
              placeholder="e.g. 10,000"
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <DialogFooter>
            {existing ? (
              <Button type="button" variant="outline" className="text-destructive" onClick={handleDelete}>
                Remove
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BudgetEditTrigger({
  categories,
  month,
  categoryId,
  budgetId,
}: {
  categories: { id: string; name: string }[];
  month: string;
  categoryId: string;
  budgetId: string;
}) {
  return (
    <BudgetFormDialog
      categories={categories}
      month={month}
      existing={{ categoryId, budgetId }}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit budget">
          <Pencil />
        </Button>
      }
    />
  );
}

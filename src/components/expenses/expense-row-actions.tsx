"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteExpenseAction } from "@/lib/actions/expenses";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";

export type ExpenseRowData = {
  id: string;
  amountPaise: number;
  dateISODate: string;
  categoryId: string;
  paymentMethod: string;
  merchant: string;
  notes: string;
};

export function ExpenseRowActions({
  expense,
  categories,
}: {
  expense: ExpenseRowData;
  categories: { id: string; name: string; color: string }[];
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <ExpenseFormDialog
        categories={categories}
        initial={{
          id: expense.id,
          amount: (expense.amountPaise / 100).toFixed(2),
          date: expense.dateISODate,
          categoryId: expense.categoryId,
          paymentMethod: expense.paymentMethod,
          merchant: expense.merchant,
          notes: expense.notes,
        }}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Edit expense">
            <Pencil />
          </Button>
        }
      />
      <ConfirmDialog
        title="Delete expense?"
        description="This permanently removes the expense."
        successMessage="Expense deleted"
        onConfirm={() => deleteExpenseAction(expense.id)}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Delete expense">
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}

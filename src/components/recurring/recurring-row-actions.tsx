"use client";

import * as React from "react";
import { Pause, Pencil, Play, SkipForward, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteRecurringAction,
  skipRecurringAction,
  toggleRecurringAction,
} from "@/lib/actions/recurring";
import { formatDayLabel, parseUTCMidnight } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RecurringFormDialog } from "./recurring-form-dialog";

export type RecurringRowData = {
  id: string;
  amountPaise: number;
  categoryId: string;
  paymentMethod: string;
  frequency: string;
  interval: number;
  startDateISO: string;
  endDateISO: string | null;
  merchant: string;
  notes: string;
  isActive: boolean;
};

export function RecurringRowActions({
  row,
  categories,
}: {
  row: RecurringRowData;
  categories: { id: string; name: string; color: string }[];
}) {
  const [busy, setBusy] = React.useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      const res = await toggleRecurringAction(row.id, !row.isActive);
      if (res.ok) {
        toast.success(row.isActive ? "Recurring expense paused" : "Recurring expense resumed");
      } else {
        toast.error(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    try {
      const res = await skipRecurringAction(row.id);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        const next = res.nextISO ? parseUTCMidnight(res.nextISO) : null;
        toast.success(next ? `Occurrence skipped — next on ${formatDayLabel(next)}` : "Occurrence skipped");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <RecurringFormDialog
        categories={categories}
        initial={{
          id: row.id,
          amount: (row.amountPaise / 100).toFixed(2),
          categoryId: row.categoryId,
          paymentMethod: row.paymentMethod,
          frequency: row.frequency,
          interval: String(row.interval),
          startDate: row.startDateISO,
          endDate: row.endDateISO ?? "",
          merchant: row.merchant,
          notes: row.notes,
        }}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Edit recurring expense" disabled={busy}>
            <Pencil />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={row.isActive ? "Pause recurring expense" : "Resume recurring expense"}
        disabled={busy}
        onClick={handleToggle}
      >
        {row.isActive ? <Pause /> : <Play />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Skip next occurrence"
        disabled={busy || !row.isActive}
        onClick={handleSkip}
      >
        <SkipForward />
      </Button>
      <ConfirmDialog
        title="Delete recurring expense?"
        description="Expenses already created from it stay; no further ones will be added."
        successMessage="Recurring expense deleted"
        onConfirm={() => deleteRecurringAction(row.id)}
        trigger={
          <Button variant="ghost" size="icon" aria-label="Delete recurring expense" disabled={busy}>
            <Trash2 className="text-destructive" />
          </Button>
        }
      />
    </div>
  );
}

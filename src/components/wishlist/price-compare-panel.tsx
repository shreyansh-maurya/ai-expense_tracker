"use client";

import * as React from "react";
import { Check, Loader2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { deletePriceQuoteAction, savePriceQuoteAction } from "@/lib/actions/wishlist";
import {
  WISHLIST_STORES,
  WISHLIST_STORE_LABELS,
  type WishlistStore,
} from "@/lib/validators/wishlist";
import {
  isAtAllTimeLow,
  lowestEverPrice,
  summarizeQuotes,
  summarizeTrend,
  type PricePoint,
} from "@/lib/wishlist-prices";
import type { PriceQuoteRow } from "@/lib/services/wishlist-prices";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const CHECKED_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const storeLabel = (store: string) =>
  WISHLIST_STORE_LABELS[store as WishlistStore] ?? store;

/** Preselect a store that has no tracked price yet, so recording a new one is one click. */
function defaultStore(quotes: PriceQuoteRow[]): WishlistStore {
  const tracked = new Set(quotes.map((q) => q.store));
  return WISHLIST_STORES.find((s) => s !== "OTHER" && !tracked.has(s)) ?? "AMAZON";
}

/**
 * The price table for one item, shown inline under the card when the arrow is
 * expanded — every tracked store price, its trend, and the all-time low, plus a
 * compact form to record a new price. Nothing here sends you to a store site.
 */
export function PriceComparePanel({
  itemId,
  quotes,
  history = [],
}: {
  itemId: string;
  quotes: PriceQuoteRow[];
  history?: PricePoint[];
}) {
  const [store, setStore] = React.useState<WishlistStore>(() => defaultStore(quotes));
  const [price, setPrice] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const summary = summarizeQuotes(quotes);
  const sorted = [...quotes].sort(
    (a, b) => a.pricePaise - b.pricePaise || a.store.localeCompare(b.store)
  );
  const maxPaise = sorted.length > 0 ? sorted[sorted.length - 1].pricePaise : 0;
  const lowest = lowestEverPrice(history);
  const atLowestEver = summary != null && isAtAllTimeLow(summary.best.pricePaise, history);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await savePriceQuoteAction(itemId, { store, price, url: "" });
      if (res.ok) {
        toast.success(`${WISHLIST_STORE_LABELS[store]} price saved`);
        setPrice("");
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div id={`prices-${itemId}`} className="space-y-3 rounded-lg border bg-muted/30 p-3">
      {summary ? (
        <div className="space-y-0.5 text-xs">
          <p className="font-medium">
            Best: {formatINR(summary.best.pricePaise)} at {storeLabel(summary.best.store)}
            <Check className="ml-1 inline size-3.5 text-green-600" />
          </p>
          {summary.highest && summary.savingsPaise > 0 ? (
            <p className="text-muted-foreground">
              Save {formatINR(summary.savingsPaise, { decimals: false })} ({summary.savingsPct}%)
              vs {formatINR(summary.highest.pricePaise)} at {storeLabel(summary.highest.store)}
            </p>
          ) : null}
          {atLowestEver ? (
            <p className="font-medium text-green-700">
              Lowest price since you started tracking.
            </p>
          ) : lowest && lowest.pricePaise < summary.best.pricePaise ? (
            <p className="text-muted-foreground">
              Cheapest seen: {formatINR(lowest.pricePaise, { decimals: false })} at{" "}
              {storeLabel(lowest.store)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No prices tracked yet — add the price you saw at any store below.
        </p>
      )}

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((q) => {
            const isBest = summary?.best.id === q.id;
            const width = Math.max(12, Math.round((q.pricePaise / maxPaise) * 100));
            const trend = summarizeTrend(history.filter((h) => h.store === q.store));
            const wasCheaper =
              trend != null && !trend.isAllTimeLow && trend.lowestPaise < q.pricePaise;
            return (
              <li key={q.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {storeLabel(q.store)}
                    {isBest ? (
                      <span className="ml-1.5 rounded bg-green-600/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                        Best
                      </span>
                    ) : null}
                    {!isBest && trend?.isAllTimeLow ? (
                      <span className="ml-1.5 rounded bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                        Lowest
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatINR(q.pricePaise, { decimals: false })}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        aria-label="Remove price"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    }
                    title="Remove this price?"
                    description="The tracked price and its history for this store will be deleted."
                    onConfirm={async () => deletePriceQuoteAction(q.id)}
                    successMessage="Price removed"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">checked {CHECKED_FORMAT.format(q.updatedAt)}</span>
                  {trend && trend.direction !== "flat" ? (
                    <span
                      className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
                        trend.direction === "down" ? "text-green-600" : "text-red-600"
                      }`}
                      title={`${formatINR(trend.firstPaise)} → ${formatINR(trend.lastPaise)} across ${trend.samples} checks`}
                    >
                      {trend.direction === "down" ? (
                        <TrendingDown className="size-3" />
                      ) : (
                        <TrendingUp className="size-3" />
                      )}
                      {trend.deltaPct}%
                    </span>
                  ) : null}
                  {wasCheaper ? (
                    <span title={`Cheapest seen at ${storeLabel(q.store)}`}>
                      low {formatINR(trend.lowestPaise, { decimals: false })}
                    </span>
                  ) : null}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${isBest ? "bg-green-600" : "bg-muted-foreground/40"}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2 border-t pt-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor={`quote-store-${itemId}`} className="text-xs">
              Store
            </Label>
            <Select
              id={`quote-store-${itemId}`}
              className="text-xs"
              value={store}
              onChange={(e) => setStore(e.target.value as WishlistStore)}
            >
              {WISHLIST_STORES.map((s) => (
                <option key={s} value={s}>
                  {WISHLIST_STORE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`quote-price-${itemId}`} className="text-xs">
              Price (₹)
            </Label>
            <Input
              id={`quote-price-${itemId}`}
              className="h-9 text-xs"
              inputMode="decimal"
              placeholder="e.g. 1,299"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" size="sm" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Save price
        </Button>
      </form>
    </div>
  );
}

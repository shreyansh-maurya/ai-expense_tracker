"use client";

import * as React from "react";
import { Check, ExternalLink, Loader2, Scale, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePriceQuoteAction, savePriceQuoteAction } from "@/lib/actions/wishlist";
import {
  WISHLIST_STORES,
  WISHLIST_STORE_LABELS,
  type WishlistStore,
} from "@/lib/validators/wishlist";
import { checkableStores, storeSearchUrl, summarizeQuotes } from "@/lib/wishlist-prices";
import type { PriceQuoteRow } from "@/lib/services/wishlist-prices";
import { formatINR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const CHECKED_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function PriceCompareDialog({
  itemId,
  itemTitle,
  quotes,
  trigger,
}: {
  itemId: string;
  itemTitle: string;
  quotes: PriceQuoteRow[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [store, setStore] = React.useState<WishlistStore>("AMAZON");
  const [price, setPrice] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const summary = summarizeQuotes(quotes);
  const sorted = [...quotes].sort(
    (a, b) => a.pricePaise - b.pricePaise || a.store.localeCompare(b.store)
  );
  const maxPaise = sorted.length > 0 ? sorted[sorted.length - 1].pricePaise : 0;
  const toCheck = checkableStores(quotes.map((q) => q.store));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await savePriceQuoteAction(itemId, { store, price, url });
      if (res.ok) {
        toast.success(`${WISHLIST_STORE_LABELS[store]} price saved`);
        setPrice("");
        setUrl("");
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
          <Button size="sm" variant="outline">
            <Scale />
            Compare
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compare prices</DialogTitle>
          <DialogDescription className="line-clamp-1">{itemTitle}</DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">
              Best: {formatINR(summary.best.pricePaise)} at{" "}
              {WISHLIST_STORE_LABELS[summary.best.store as WishlistStore] ?? summary.best.store}
              <Check className="ml-1 inline size-4 text-green-600" />
            </p>
            {summary.highest && summary.savingsPaise > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Save {formatINR(summary.savingsPaise, { decimals: false })} (
                {summary.savingsPct}%) vs {formatINR(summary.highest.pricePaise)} at{" "}
                {WISHLIST_STORE_LABELS[summary.highest.store as WishlistStore] ??
                  summary.highest.store}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Check more stores below to see potential savings.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No prices tracked yet — open a store below, find the item and save the price you saw.
          </p>
        )}

        {sorted.length > 0 ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {sorted.map((q) => {
              const isBest = summary?.best.id === q.id;
              const width = Math.max(12, Math.round((q.pricePaise / maxPaise) * 100));
              return (
                <li key={q.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {WISHLIST_STORE_LABELS[q.store as WishlistStore] ?? q.store}
                      {isBest ? (
                        <span className="ml-1.5 rounded bg-green-600/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                          Best
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      checked {CHECKED_FORMAT.format(q.updatedAt)}
                    </span>
                    {q.url ? (
                      <a
                        href={q.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${q.store} listing`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
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
                      description="The tracked price for this store will be deleted."
                      onConfirm={async () => deletePriceQuoteAction(q.id)}
                      successMessage="Price removed"
                    />
                    <span className="w-20 text-right font-semibold tabular-nums">
                      {formatINR(q.pricePaise, { decimals: false })}
                    </span>
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

        {toCheck.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Check prices at</p>
            <div className="flex flex-wrap gap-1.5">
              {toCheck.map((s) => (
                <a
                  key={s}
                  href={storeSearchUrl(s, itemTitle) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setStore(s)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
                >
                  <Search className="size-3" />
                  {WISHLIST_STORE_LABELS[s]}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`quote-store-${itemId}`}>Store</Label>
              <Select
                id={`quote-store-${itemId}`}
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
            <div className="grid gap-1.5">
              <Label htmlFor={`quote-price-${itemId}`}>Price (₹)</Label>
              <Input
                id={`quote-price-${itemId}`}
                inputMode="decimal"
                placeholder="e.g. 1,299"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`quote-url-${itemId}`}>Listing link (optional)</Label>
            <Input
              id={`quote-url-${itemId}`}
              type="url"
              placeholder="https://www.flipkart.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Save price
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

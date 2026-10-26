"use client";

import * as React from "react";
import {
  ExternalLink,
  Gift,
  ImageOff,
  Loader2,
  PackageCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteWishlistAction,
  logBoughtAction,
  setWishlistStatusAction,
} from "@/lib/actions/wishlist";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/validators/expense";
import {
  WISHLIST_STORE_LABELS,
  type WishlistStore,
} from "@/lib/validators/wishlist";
import { formatINR } from "@/lib/money";
import { todayISODate } from "@/lib/dates";
import type { WishlistRow } from "@/lib/services/wishlist";
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
} from "@/components/ui/dialog";
import { WishlistEditTrigger } from "@/components/wishlist/wishlist-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  WANTED: "To buy",
  ORDERED: "Ordered",
  BOUGHT: "Bought",
  DROPPED: "Dropped",
};

const PRIORITY_BADGE: Record<
  string,
  { label: string; variant: "destructive" | "secondary" | "outline" | null }
> = {
  HIGH: { label: "High", variant: "destructive" },
  MEDIUM: { label: "Medium", variant: "secondary" },
  LOW: { label: "Low", variant: "outline" },
};

export function WishlistItemCard({
  item,
  categories,
}: {
  item: WishlistRow;
  categories: { id: string; name: string; color: string }[];
}) {
  const [pending, setPending] = React.useState(false);
  const [boughtOpen, setBoughtOpen] = React.useState(false);

  async function transition(status: string) {
    setPending(true);
    try {
      const res = await setWishlistStatusAction(item.id, status);
      if (res.ok) toast.success(`Marked as ${STATUS_LABELS[status] ?? status.toLowerCase()}`);
      else toast.error(res.error);
    } finally {
      setPending(false);
    }
  }

  const priority =
    PRIORITY_BADGE[item.priority] ?? { label: item.priority, variant: "outline" as const };

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        {item.imageUrl ? (
          // Remote product images are user-supplied URLs of arbitrary hosts —
          // next/image requires whitelisting every store's CDN, so plain img is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="size-14 shrink-0 rounded-lg border object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <ImageOff className="size-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {WISHLIST_STORE_LABELS[item.store as WishlistStore] ?? item.store}
            </Badge>
            {item.status !== "WANTED" ? (
              <Badge
                variant={item.status === "BOUGHT" ? "default" : "outline"}
                className="text-xs"
              >
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            ) : (
              <Badge variant={priority.variant ?? "outline"} className="text-xs">
                {priority.label} priority
              </Badge>
            )}
          </div>
        </div>
      </div>

      {item.notes ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {item.pricePaise != null ? formatINR(item.pricePaise) : "—"}
        </span>
        <div className="flex items-center gap-1">
          {item.url ? (
            <Button asChild variant="ghost" size="icon" aria-label="Open product link">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
              </a>
            </Button>
          ) : null}
          <WishlistEditTrigger
            item={{
              id: item.id,
              title: item.title,
              url: item.url ?? "",
              store: item.store,
              price: item.pricePaise != null ? String(item.pricePaise / 100) : "",
              imageUrl: item.imageUrl ?? "",
              priority: item.priority,
              notes: item.notes ?? "",
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <Select
          aria-label="Change status"
          className="max-w-32 text-xs"
          value={item.status}
          onChange={(e) => transition(e.target.value)}
          disabled={pending}
        >
          <option value="WANTED">To buy</option>
          <option value="ORDERED">Ordered</option>
          <option value="BOUGHT">Bought</option>
          <option value="DROPPED">Dropped</option>
        </Select>
        <div className="flex items-center gap-1">
          {item.status === "BOUGHT" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Gift className="size-3.5" />
              In your ledger
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setBoughtOpen(true)}>
              {pending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
              Log as expense
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Remove from wishlist">
                <Trash2 />
              </Button>
            }
            title="Remove from wishlist?"
            description={`"${item.title}" will be removed. If you logged it as an expense, the expense stays in your ledger.`}
            onConfirm={async () => deleteWishlistAction(item.id)}
            successMessage="Removed from wishlist"
          />
        </div>
      </div>

      <BoughtDialog
        item={item}
        categories={categories}
        open={boughtOpen}
        onOpenChange={setBoughtOpen}
      />
    </div>
  );
}

function BoughtDialog({
  item,
  categories,
  open,
  onOpenChange,
}: {
  item: WishlistRow;
  categories: { id: string; name: string; color: string }[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [amount, setAmount] = React.useState(
    item.pricePaise != null ? String(item.pricePaise / 100) : ""
  );
  const [date, setDate] = React.useState(todayISODate());
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [method, setMethod] = React.useState("UPI");
  const [merchant, setMerchant] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAmount(item.pricePaise != null ? String(item.pricePaise / 100) : "");
      setDate(todayISODate());
      setCategoryId(categories[0]?.id ?? "");
      setMethod("UPI");
      setMerchant("");
    }
  }, [open, item.pricePaise, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await logBoughtAction(item.id, {
        amount,
        date,
        categoryId,
        paymentMethod: method,
        merchant,
        notes: "",
      });
      if (res.ok) {
        toast.success("Logged as an expense and marked bought");
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bought — {item.title}</DialogTitle>
          <DialogDescription>
            Creates a regular expense (shows on the dashboard, budgets and expenses pages) and
            marks the item bought.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={`bought-amount-${item.id}`}>Amount paid (₹)</Label>
              <Input
                id={`bought-amount-${item.id}`}
                inputMode="decimal"
                placeholder="e.g. 2,499"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`bought-date-${item.id}`}>Date</Label>
              <Input
                id={`bought-date-${item.id}`}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`bought-category-${item.id}`}>Category</Label>
            <Select
              id={`bought-category-${item.id}`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`bought-method-${item.id}`}>Payment method</Label>
            <Select
              id={`bought-method-${item.id}`}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`bought-merchant-${item.id}`}>Merchant (optional)</Label>
            <Input
              id={`bought-merchant-${item.id}`}
              placeholder="e.g. Amazon"
              maxLength={120}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
              Log expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { Link2, Loader2, Pencil, Plus, Save, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { saveWishlistAction } from "@/lib/actions/wishlist";
import {
  WISHLIST_STORES,
  WISHLIST_STORE_LABELS,
  WISHLIST_PRIORITIES,
  detectStoreFromUrl,
  type WishlistStore,
} from "@/lib/validators/wishlist";
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

export type WishlistFormValues = {
  id?: string;
  title: string;
  url: string;
  store: string;
  price: string;
  imageUrl: string;
  priority: string;
  notes: string;
};

const emptyValues: WishlistFormValues = { title: "", url: "", store: "", price: "", imageUrl: "", priority: "MEDIUM", notes: "" };

export function WishlistFormDialog({
  trigger,
  existing,
}: {
  trigger: React.ReactNode;
  existing?: WishlistFormValues;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState<WishlistFormValues>(existing ?? emptyValues);
  const [autoStore, setAutoStore] = React.useState<string | null>(null);

  function set<K extends keyof WishlistFormValues>(key: K, v: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      if (key === "url" && !next.store) {
        const detected = detectStoreFromUrl(v);
        setAutoStore(detected);
        if (detected) next.store = detected;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await saveWishlistAction(
        {
          title: values.title,
          url: values.url,
          store: values.store || undefined,
          price: values.price,
          imageUrl: values.imageUrl,
          priority: values.priority,
          notes: values.notes,
        },
        values.id
      );
      if (res.ok) {
        toast.success(values.id ? "Wishlist item updated" : "Added to your wishlist");
        setOpen(false);
        if (!values.id) setValues(emptyValues);
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !existing) setValues(emptyValues); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{values.id ? "Edit wishlist item" : "Add to wishlist"}</DialogTitle>
          <DialogDescription>
            Paste a product link and the store is detected automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="wl-title">Product name</Label>
            <Input
              id="wl-title"
              placeholder="e.g. Running shoes"
              required
              maxLength={140}
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-url" className="gap-1">
              Product link (optional) <Link2 className="size-3.5 opacity-60" />
            </Label>
            <Input
              id="wl-url"
              inputMode="url"
              placeholder="https://www.amazon.in/dp/…"
              value={values.url}
              onChange={(e) => set("url", e.target.value)}
            />
            {autoStore && !values.store ? (
              <p className="text-xs text-muted-foreground">
                <ShoppingBag className="mr-1 inline size-3" />
                {WISHLIST_STORE_LABELS[autoStore as WishlistStore]} detected from the link
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-store">Store</Label>
              <Select id="wl-store" value={values.store} onChange={(e) => { setAutoStore(null); set("store", e.target.value); }}>
                <option value="">Auto-detect</option>
                {WISHLIST_STORES.map((s) => (
                  <option key={s} value={s}>
                    {WISHLIST_STORE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-price">Price (₹, optional)</Label>
              <Input
                id="wl-price"
                inputMode="decimal"
                placeholder="e.g. 2,499"
                value={values.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="wl-priority">Priority</Label>
              <Select id="wl-priority" value={values.priority} onChange={(e) => set("priority", e.target.value)}>
                {WISHLIST_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0] + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wl-image">Image link (optional)</Label>
              <Input
                id="wl-image"
                inputMode="url"
                placeholder="https://m.media-amazon.com/…"
                value={values.imageUrl}
                onChange={(e) => set("imageUrl", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wl-notes">Notes (optional)</Label>
            <Textarea
              id="wl-notes"
              placeholder="Size, colour, alternate stores…"
              maxLength={1000}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />}
              {values.id ? "Save changes" : "Add to wishlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WishlistEditTrigger({ item }: { item: WishlistFormValues }) {
  return (
    <WishlistFormDialog
      existing={item}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edit wishlist item">
          <Pencil />
        </Button>
      }
    />
  );
}

export function WishlistAddTrigger({ variant = "default" }: { variant?: "default" | "outline" }) {
  return (
    <WishlistFormDialog
      trigger={
        <Button variant={variant}>
          {variant === "outline" ? <ShoppingBag /> : <Plus />}
          Add to wishlist
        </Button>
      }
    />
  );
}

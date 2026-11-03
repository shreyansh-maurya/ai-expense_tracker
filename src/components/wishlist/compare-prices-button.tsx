"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshWishlistPricesAction } from "@/lib/actions/wishlist";
import { Button } from "@/components/ui/button";

/**
 * The on-demand price refresh: one click reads the current price from every
 * wishlist product link and records it as that store's quote, which is what the
 * comparison panel and the price history are built from.
 */
export function ComparePricesButton({ itemCount }: { itemCount: number }) {
  const [pending, setPending] = React.useState(false);

  async function run() {
    setPending(true);
    try {
      const res = await refreshWishlistPricesAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.updated > 0) {
        toast.success(
          res.updated === 1 ? "Fetched 1 price" : `Fetched ${res.updated} prices`,
          {
            description:
              res.failures.length > 0
                ? res.failures.map((f) => `${f.title}: ${f.error}`).join("\n")
                : undefined,
          }
        );
      }
      if (res.failures.length > 0) {
        toast.error(
          res.updated === 0
            ? "Couldn't fetch any prices"
            : `${res.failures.length} price${res.failures.length === 1 ? "" : "s"} could not be fetched`,
          { description: res.failures.map((f) => `${f.title}: ${f.error}`).join("\n") }
        );
      }
    } catch {
      toast.error("Price check failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={run}
      disabled={pending || itemCount === 0}
      title={
        itemCount === 0
          ? "Add a product link to a wishlist item first"
          : `Fetch the current price for ${itemCount} product link${itemCount === 1 ? "" : "s"}`
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Checking prices…" : "Compare prices"}
    </Button>
  );
}

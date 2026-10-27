import { Gift, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/money";
import { listWishlist } from "@/lib/services/wishlist";
import { listAllPriceQuotes } from "@/lib/services/wishlist-prices";
import { listActiveCategories } from "@/lib/services/categories";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WishlistAddTrigger } from "@/components/wishlist/wishlist-form-dialog";
import { WishlistItemCard } from "@/components/wishlist/wishlist-item-card";
import { CardTitle, CardHeader, Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Wishlist" };

type Group = {
  key: "WANTED" | "ORDERED" | "BOUGHT";
  label: string;
  description: string;
  rows: Awaited<ReturnType<typeof listWishlist>>;
};

function groupOf(rows: Awaited<ReturnType<typeof listWishlist>>) {
  const wanted = rows.filter((r) => r.status === "WANTED");
  const ordered = rows.filter((r) => r.status === "ORDERED");
  const bought = rows.filter((r) => r.status === "BOUGHT");
  const groups: Group[] = [
    {
      key: "WANTED",
      label: "To buy",
      description: "Saved and waiting for the right price (or mood).",
      rows: wanted,
    },
    {
      key: "ORDERED",
      label: "Ordered",
      description: "On the way — log it as an expense when it lands.",
      rows: ordered,
    },
    {
      key: "BOUGHT",
      label: "Bought",
      description: "Completed purchases. Linked expenses stay in your ledger even if these are removed.",
      rows: bought,
    },
  ];
  return { groups, wanted, ordered, bought };
}

export default async function WishlistPage() {
  const [rows, categories, quotesByItem] = await Promise.all([
    listWishlist(),
    listActiveCategories(),
    listAllPriceQuotes(),
  ]);
  const { groups, wanted, ordered, bought } = groupOf(rows);

  const wishlistValuePaise = wanted
    .concat(ordered)
    .reduce((sum, r) => sum + (r.pricePaise ?? 0), 0);
  const spentOnWishlistPaise = bought.reduce((sum, r) => sum + (r.pricePaise ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wishlist</h1>
          <p className="text-sm text-muted-foreground">
            Products you plan to buy from Amazon, Flipkart, Myntra and more — track and compare
            prices across stores before the money leaves your account
          </p>
        </div>
        <WishlistAddTrigger />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Your wishlist is empty"
          description="Paste a product link from any store — we detect the store automatically and track the price until you buy it."
          action={<WishlistAddTrigger variant="outline" />}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Planned
                  </CardTitle>
                  <p className="text-2xl font-semibold tabular-nums">{wanted.length + ordered.length}</p>
                </div>
                <ShoppingBag className="text-muted-foreground" />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Wishlist value
                  </CardTitle>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatINR(wishlistValuePaise, { decimals: false })}
                  </p>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Bought via wishlist
                  </CardTitle>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatINR(spentOnWishlistPaise, { decimals: false })}
                  </p>
                </div>
              </CardHeader>
            </Card>
          </div>

          {groups
            .filter((g) => g.rows.length > 0 || g.key === "WANTED")
            .map((g) => (
              <section key={g.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{g.label}</h2>
                  <Badge variant="secondary">{g.rows.length}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{g.description}</p>
                {g.rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Nothing here right now.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {g.rows.map((r) => (
                      <WishlistItemCard
                        key={r.id}
                        item={r}
                        categories={categories}
                        quotes={quotesByItem[r.id] ?? []}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
        </>
      )}
    </div>
  );
}

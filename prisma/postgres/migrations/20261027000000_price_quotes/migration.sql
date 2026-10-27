-- WishlistPriceQuote: the current tracked price of a wishlist item at each
-- store. One row per (item, store) — re-checking a store updates the price.
-- Scalar store/price union conventions match WishlistItem.

CREATE TABLE "WishlistPriceQuote" (
    "id" TEXT NOT NULL,
    "wishlistItemId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistPriceQuote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WishlistPriceQuote_wishlistItemId_idx" ON "WishlistPriceQuote"("wishlistItemId");
CREATE UNIQUE INDEX "WishlistPriceQuote_wishlistItemId_store_key" ON "WishlistPriceQuote"("wishlistItemId", "store");

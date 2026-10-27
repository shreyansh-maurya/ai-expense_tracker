-- WishlistPriceQuote: the current tracked price of a wishlist item at each
-- store. One row per (item, store) — re-checking a store updates the price.
-- Scalar store/price union conventions match WishlistItem.

-- CreateTable
CREATE TABLE "WishlistPriceQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wishlistItemId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "url" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WishlistPriceQuote_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WishlistPriceQuote_wishlistItemId_idx" ON "WishlistPriceQuote"("wishlistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistPriceQuote_wishlistItemId_store_key" ON "WishlistPriceQuote"("wishlistItemId", "store");

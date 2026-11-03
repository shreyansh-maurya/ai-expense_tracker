-- WishlistPriceSnapshot: append-only price history. WishlistPriceQuote keeps the
-- current price per (item, store); this table keeps each observed change so the
-- compare dialog can show a trend and the cheapest price ever seen.

CREATE TABLE "WishlistPriceSnapshot" (
    "id" TEXT NOT NULL,
    "wishlistItemId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistPriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WishlistPriceSnapshot_wishlistItemId_store_recordedAt_idx" ON "WishlistPriceSnapshot"("wishlistItemId", "store", "recordedAt");

ALTER TABLE "WishlistPriceSnapshot" ADD CONSTRAINT "WishlistPriceSnapshot_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

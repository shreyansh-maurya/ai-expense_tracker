-- WishlistItem: products the user plans to buy from any store.
-- Scalar string unions (store/priority/status) and a scalar expenseId link
-- match the portability-first conventions of this schema.

CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "store" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pricePaise" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'WANTED',
    "notes" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WishlistItem_status_idx" ON "WishlistItem"("status");

-- Accounts: every row gets an owner. Existing rows are parked on a placeholder
-- user that the first signup adopts (adoptLegacyData in src/lib/auth.ts).

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Placeholder owner for pre-auth data
INSERT INTO "User" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
VALUES ('usr_legacy', 'legacy@local.invalid', NULL, 'scrypt$legacy$00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Category: nullable column → backfill → enforce, and scope the name uniqueness
ALTER TABLE "Category" ADD COLUMN "userId" TEXT;
UPDATE "Category" SET "userId" = 'usr_legacy' WHERE "userId" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX IF EXISTS "Category_name_key";
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Expense
ALTER TABLE "Expense" ADD COLUMN "userId" TEXT;
UPDATE "Expense" SET "userId" = 'usr_legacy' WHERE "userId" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RecurringExpense
ALTER TABLE "RecurringExpense" ADD COLUMN "userId" TEXT;
UPDATE "RecurringExpense" SET "userId" = 'usr_legacy' WHERE "userId" IS NULL;
ALTER TABLE "RecurringExpense" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "RecurringExpense_userId_isActive_nextDate_idx" ON "RecurringExpense"("userId", "isActive", "nextDate");
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Budget: uniqueness now includes the owner
ALTER TABLE "Budget" ADD COLUMN "userId" TEXT;
UPDATE "Budget" SET "userId" = 'usr_legacy' WHERE "userId" IS NULL;
ALTER TABLE "Budget" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX IF EXISTS "Budget_categoryId_month_key";
CREATE UNIQUE INDEX "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month");
CREATE INDEX "Budget_userId_month_idx" ON "Budget"("userId", "month");
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WishlistItem (quotes and snapshots inherit ownership through their item)
ALTER TABLE "WishlistItem" ADD COLUMN "userId" TEXT;
UPDATE "WishlistItem" SET "userId" = 'usr_legacy' WHERE "userId" IS NULL;
ALTER TABLE "WishlistItem" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "WishlistItem_userId_status_idx" ON "WishlistItem"("userId", "status");
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - Added the required column `userId` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `RecurringExpense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `WishlistItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Rows that predate accounts are parked on a placeholder user; the first
-- signup adopts them (adoptLegacyData in src/lib/auth.ts).
INSERT INTO "User" ("id", "email", "name", "passwordHash", "createdAt", "updatedAt")
VALUES ('usr_legacy', 'legacy@local.invalid', NULL, 'scrypt$legacy$00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "month" TEXT NOT NULL,
    "limitPaise" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("userId", "categoryId", "createdAt", "id", "limitPaise", "month", "updatedAt") SELECT 'usr_legacy', "categoryId", "createdAt", "id", "limitPaise", "month", "updatedAt" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE INDEX "Budget_userId_month_idx" ON "Budget"("userId", "month");
CREATE UNIQUE INDEX "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month");
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "keywords" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("userId", "color", "createdAt", "icon", "id", "isArchived", "isDefault", "keywords", "name", "updatedAt") SELECT 'usr_legacy', "color", "createdAt", "icon", "id", "isArchived", "isDefault", "keywords", "name", "updatedAt" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "merchant" TEXT,
    "merchantNorm" TEXT,
    "notes" TEXT,
    "categorizedBy" TEXT NOT NULL DEFAULT 'USER',
    "recurringId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("userId", "amountPaise", "categorizedBy", "categoryId", "createdAt", "date", "id", "merchant", "merchantNorm", "notes", "paymentMethod", "recurringId", "updatedAt") SELECT 'usr_legacy', "amountPaise", "categorizedBy", "categoryId", "createdAt", "date", "id", "merchant", "merchantNorm", "notes", "paymentMethod", "recurringId", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_merchantNorm_idx" ON "Expense"("merchantNorm");
CREATE INDEX "Expense_categoryId_date_idx" ON "Expense"("categoryId", "date");
CREATE UNIQUE INDEX "Expense_recurringId_date_key" ON "Expense"("recurringId", "date");
CREATE TABLE "new_RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "merchant" TEXT,
    "notes" TEXT,
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "nextDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecurringExpense" ("userId", "amountPaise", "categoryId", "createdAt", "endDate", "frequency", "id", "interval", "isActive", "merchant", "nextDate", "notes", "paymentMethod", "startDate", "updatedAt") SELECT 'usr_legacy', "amountPaise", "categoryId", "createdAt", "endDate", "frequency", "id", "interval", "isActive", "merchant", "nextDate", "notes", "paymentMethod", "startDate", "updatedAt" FROM "RecurringExpense";
DROP TABLE "RecurringExpense";
ALTER TABLE "new_RecurringExpense" RENAME TO "RecurringExpense";
CREATE INDEX "RecurringExpense_userId_isActive_nextDate_idx" ON "RecurringExpense"("userId", "isActive", "nextDate");
CREATE INDEX "RecurringExpense_isActive_nextDate_idx" ON "RecurringExpense"("isActive", "nextDate");
CREATE TABLE "new_WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "store" TEXT NOT NULL,
    "imageUrl" TEXT,
    "pricePaise" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'WANTED',
    "notes" TEXT,
    "expenseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WishlistItem" ("userId", "createdAt", "expenseId", "id", "imageUrl", "notes", "pricePaise", "priority", "status", "store", "title", "updatedAt", "url") SELECT 'usr_legacy', "createdAt", "expenseId", "id", "imageUrl", "notes", "pricePaise", "priority", "status", "store", "title", "updatedAt", "url" FROM "WishlistItem";
DROP TABLE "WishlistItem";
ALTER TABLE "new_WishlistItem" RENAME TO "WishlistItem";
CREATE INDEX "WishlistItem_userId_status_idx" ON "WishlistItem"("userId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

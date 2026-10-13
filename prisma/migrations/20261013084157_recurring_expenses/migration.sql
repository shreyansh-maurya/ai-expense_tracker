-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringExpense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amountPaise", "categorizedBy", "categoryId", "createdAt", "date", "id", "merchant", "merchantNorm", "notes", "paymentMethod", "updatedAt") SELECT "amountPaise", "categorizedBy", "categoryId", "createdAt", "date", "id", "merchant", "merchantNorm", "notes", "paymentMethod", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_merchantNorm_idx" ON "Expense"("merchantNorm");
CREATE INDEX "Expense_categoryId_date_idx" ON "Expense"("categoryId", "date");
CREATE UNIQUE INDEX "Expense_recurringId_date_key" ON "Expense"("recurringId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RecurringExpense_isActive_nextDate_idx" ON "RecurringExpense"("isActive", "nextDate");

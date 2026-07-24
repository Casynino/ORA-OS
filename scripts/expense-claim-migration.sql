-- Expense Claims — Finance records completed expenses; CEO reviews + allocates.
-- Run ONCE on Neon (SQL Editor, production branch) BEFORE the deploy goes live,
-- and once on your local `ora` database if you test locally.
--
-- This is hand-curated to add ONLY the new objects — it deliberately does NOT
-- include the unrelated drops the auto-diff suggested (FieldCustomer FK,
-- playing_with_neon), which would be harmful. Wrapped in a transaction: it all
-- applies or none of it does.

BEGIN;

-- 1. Status of a whole submission
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. Link column on Expense — the real rows booked when a claim is approved
ALTER TABLE "Expense" ADD COLUMN "expenseClaimId" TEXT;

-- 3. Claim header (one submission = many items)
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "paymentAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- 4. Claim line items (each with a required receipt)
CREATE TABLE "ExpenseClaimItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OFFICE',
    "customCategory" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "receiptRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseClaimItem_pkey" PRIMARY KEY ("id")
);

-- 5. Indexes
CREATE UNIQUE INDEX "ExpenseClaim_code_key" ON "ExpenseClaim"("code");
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");
CREATE INDEX "ExpenseClaim_recordedById_idx" ON "ExpenseClaim"("recordedById");
CREATE INDEX "ExpenseClaim_createdAt_idx" ON "ExpenseClaim"("createdAt");
CREATE INDEX "ExpenseClaimItem_claimId_idx" ON "ExpenseClaimItem"("claimId");

-- 6. Foreign keys
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseClaimId_fkey"
    FOREIGN KEY ("expenseClaimId") REFERENCES "ExpenseClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_paymentAccountId_fkey"
    FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaimItem" ADD CONSTRAINT "ExpenseClaimItem_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

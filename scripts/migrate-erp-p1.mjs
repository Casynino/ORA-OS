// ERP finance overhaul — Phase 1 schema (idempotent, additive only).
//   - ExpenseCategoryOption table (persisted custom categories)
//   - PettyCashRequestItem table (multi-item request "cart") + customCategory
//   - Expense.pettyCashRequestId (link allocation expenses to their request) + batchCode
//   + supporting indexes + FKs. Never drops anything.
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-direct-url> node scripts/migrate-erp-p1.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";
const run = (sql) => p.$executeRawUnsafe(sql);
const constraint = (sql) => run(`DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

try {
  // ── ExpenseCategoryOption ──────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS "ExpenseCategoryOption" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "group" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExpenseCategoryOption_pkey" PRIMARY KEY ("id")
    );`);
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategoryOption_name_key" ON "ExpenseCategoryOption"("name");`);
  await run(`CREATE INDEX IF NOT EXISTS "ExpenseCategoryOption_active_idx" ON "ExpenseCategoryOption"("active");`);
  await constraint(`ALTER TABLE "ExpenseCategoryOption" ADD CONSTRAINT "ExpenseCategoryOption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`);

  // ── PettyCashRequestItem (create if the dormant model was never pushed) ─────
  await run(`
    CREATE TABLE IF NOT EXISTS "PettyCashRequestItem" (
      "id" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "category" "ExpenseCategory" NOT NULL DEFAULT 'OFFICE',
      "customCategory" TEXT,
      "description" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PettyCashRequestItem_pkey" PRIMARY KEY ("id")
    );`);
  await run(`ALTER TABLE "PettyCashRequestItem" ADD COLUMN IF NOT EXISTS "customCategory" TEXT;`);
  await run(`CREATE INDEX IF NOT EXISTS "PettyCashRequestItem_requestId_idx" ON "PettyCashRequestItem"("requestId");`);
  await constraint(`ALTER TABLE "PettyCashRequestItem" ADD CONSTRAINT "PettyCashRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PettyCashRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE`);

  // ── Expense links ──────────────────────────────────────────────────────────
  await run(`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "pettyCashRequestId" TEXT;`);
  await run(`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "batchCode" TEXT;`);
  await run(`CREATE INDEX IF NOT EXISTS "Expense_pettyCashRequestId_idx" ON "Expense"("pettyCashRequestId");`);
  await constraint(`ALTER TABLE "Expense" ADD CONSTRAINT "Expense_pettyCashRequestId_fkey" FOREIGN KEY ("pettyCashRequestId") REFERENCES "PettyCashRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE`);

  console.log(`✓ ERP Phase 1 schema migrated on ${host}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  await p.$disconnect();
  process.exit(1);
}
await p.$disconnect();

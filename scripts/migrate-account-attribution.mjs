// Account-attribution schema additions (idempotent).
//   - CapitalEntry.paymentAccountId  (account an investment lands in / a withdrawal leaves)
//   - Expense.paymentAccountId       (account an expense / fund allocation / payroll was paid from)
//   + supporting indexes + FK constraints (ON DELETE SET NULL)
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-url> node scripts/migrate-account-attribution.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";

try {
  await p.$executeRawUnsafe(`ALTER TABLE "CapitalEntry" ADD COLUMN IF NOT EXISTS "paymentAccountId" TEXT;`);
  await p.$executeRawUnsafe(`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paymentAccountId" TEXT;`);

  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CapitalEntry_paymentAccountId_idx" ON "CapitalEntry"("paymentAccountId");`);
  await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_paymentAccountId_idx" ON "Expense"("paymentAccountId");`);

  // Foreign keys — guarded so re-runs are safe (no IF NOT EXISTS for constraints).
  await p.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "CapitalEntry"
        ADD CONSTRAINT "CapitalEntry_paymentAccountId_fkey"
        FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await p.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "Expense"
        ADD CONSTRAINT "Expense_paymentAccountId_fkey"
        FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  console.log(`✓ Account-attribution schema migrated on ${host}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  await p.$disconnect();
  process.exit(1);
}
await p.$disconnect();

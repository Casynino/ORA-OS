// Multi-role customer registration + opening balances — schema (idempotent,
// additive + one nullable-relax; never drops data).
//   - FieldCustomer.registeredById : who created the profile (rep/finance/admin)
//   - FieldCustomer.repId           : relaxed to NULLABLE (managing rep optional)
//   - FieldSale.isOpeningBalance    : migrated pre-ORA-OS debt (receivable, not a sale)
//
// Backward-compatible (old code keeps running), so apply to Neon BEFORE deploying:
//   DATABASE_URL=<neon-direct-url> node scripts/migrate-customer-registration.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";
const run = (sql) => p.$executeRawUnsafe(sql);

try {
  console.log(`→ Migrating customer-registration schema on ${host}`);

  // FieldCustomer: registeredBy + optional managing rep
  await run(`ALTER TABLE "FieldCustomer" ADD COLUMN IF NOT EXISTS "registeredById" TEXT;`);
  await run(`ALTER TABLE "FieldCustomer" ALTER COLUMN "repId" DROP NOT NULL;`);
  await run(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FieldCustomer_registeredById_fkey'
      ) THEN
        ALTER TABLE "FieldCustomer"
          ADD CONSTRAINT "FieldCustomer_registeredById_fkey"
          FOREIGN KEY ("registeredById") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`);
  await run(`CREATE INDEX IF NOT EXISTS "FieldCustomer_registeredById_idx" ON "FieldCustomer"("registeredById");`);

  // FieldSale: opening-balance flag
  await run(`ALTER TABLE "FieldSale" ADD COLUMN IF NOT EXISTS "isOpeningBalance" BOOLEAN NOT NULL DEFAULT false;`);
  await run(`CREATE INDEX IF NOT EXISTS "FieldSale_isOpeningBalance_idx" ON "FieldSale"("isOpeningBalance");`);

  console.log("✓ Done — registeredById + nullable repId + isOpeningBalance present.");
} catch (e) {
  console.error("✗ Migration failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

// Multi-item Operational-Fund spending — schema (idempotent, additive only).
//   - OperationalSpend.batchCode : links line items recorded together as one
//     spend transaction (each item stays its own row / individually traceable).
// Never drops anything.
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-direct-url> node scripts/migrate-opspend-batch.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";
const run = (sql) => p.$executeRawUnsafe(sql);

try {
  console.log(`→ Migrating OperationalSpend.batchCode on ${host}`);
  await run(`ALTER TABLE "OperationalSpend" ADD COLUMN IF NOT EXISTS "batchCode" TEXT;`);
  await run(`CREATE INDEX IF NOT EXISTS "OperationalSpend_batchCode_idx" ON "OperationalSpend"("batchCode");`);
  console.log("✓ Done — OperationalSpend.batchCode present.");
} catch (e) {
  console.error("✗ Migration failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

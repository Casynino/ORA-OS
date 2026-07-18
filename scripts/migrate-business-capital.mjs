// Business Capital control-center schema additions (idempotent).
//   - CapitalType enum value WITHDRAWAL (owner takes money out — stored NEGATIVE)
//   - CapitalEntry.receiptUrl  (optional supporting document for a capital move)
//   - Expense.customCategory   (free-text label when no preset category fits)
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-url> node scripts/migrate-business-capital.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";

try {
  // ALTER TYPE ... ADD VALUE must run outside a transaction — $executeRawUnsafe does.
  await p.$executeRawUnsafe(`ALTER TYPE "CapitalType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';`);
  await p.$executeRawUnsafe(`ALTER TABLE "CapitalEntry" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;`);
  await p.$executeRawUnsafe(`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "customCategory" TEXT;`);
  console.log(`✓ Business Capital schema migrated on ${host}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  await p.$disconnect();
  process.exit(1);
}
await p.$disconnect();

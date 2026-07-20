// FieldSale.directSale — marks a head-office sale recorded directly by
// Admin/Finance (stock drawn from the warehouse, confirmed on the spot). Drives
// the warehouse-return reversal path in voidFieldSale. Additive + defaulted, so
// it's backward-compatible (migrate-then-deploy is safe).
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-url> node scripts/migrate-directsale.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";

try {
  await p.$executeRawUnsafe(
    `ALTER TABLE "FieldSale" ADD COLUMN IF NOT EXISTS "directSale" BOOLEAN NOT NULL DEFAULT false;`,
  );
  console.log(`✓ FieldSale.directSale migrated on ${host}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

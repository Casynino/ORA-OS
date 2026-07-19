// FieldSaleItem.defaultPrice — records the product's standard selling price at
// the moment of sale, alongside the actual unitPrice charged (for actual-vs-list
// reporting). Additive + nullable = backward-compatible; run on Neon BEFORE deploy.
//   DATABASE_URL=<neon-direct-url> node scripts/migrate-fieldsaleitem-defaultprice.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";

try {
  console.log(`→ Adding FieldSaleItem.defaultPrice on ${host}`);
  await p.$executeRawUnsafe(`ALTER TABLE "FieldSaleItem" ADD COLUMN IF NOT EXISTS "defaultPrice" INTEGER;`);
  console.log("✓ Done — FieldSaleItem.defaultPrice present.");
} catch (e) {
  console.error("✗ Migration failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

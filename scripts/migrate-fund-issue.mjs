// Operational-Fund "CEO issues funds → Finance confirms receipt" flow (idempotent).
//   - PettyCashStatus enum value ISSUED (CEO pushed funds, awaiting Finance's
//     receipt confirmation; not yet booked as an expense)
//
// Run against Neon BEFORE deploying:
//   DATABASE_URL=<neon-url> node scripts/migrate-fund-issue.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";

try {
  // ALTER TYPE ... ADD VALUE must run outside a transaction — $executeRawUnsafe does.
  await p.$executeRawUnsafe(`ALTER TYPE "PettyCashStatus" ADD VALUE IF NOT EXISTS 'ISSUED';`);
  console.log(`✓ Operational-Fund issue flow migrated on ${host}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  await p.$disconnect();
  process.exit(1);
}
await p.$disconnect();

/**
 * Backfill: sales & collections recorded BEFORE the finance-approval gate
 * existed were already counted as company money — mark them APPROVED so
 * reports don't change retroactively. Idempotent AND safe to re-run.
 *
 * CUTOFF is a FIXED instant (the gate's go-live). Only rows created before it
 * are backfilled — so re-running this after deploy can NEVER auto-approve a
 * legitimately-pending sale and silently bypass finance verification.
 *
 * Run:  npx tsx prisma/backfill-finance-approval.ts
 * Neon: DATABASE_URL=<neon> DIRECT_URL=<neon> npx tsx prisma/backfill-finance-approval.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Go-live boundary for the finance-approval gate. Never change this — moving it
// forward would retroactively approve sales that finance was meant to review.
const CUTOFF = new Date("2026-07-17T03:28:42.000Z");

async function main() {
  const [sales, payments] = await Promise.all([
    prisma.fieldSale.updateMany({
      where: { financeStatus: "PENDING", createdAt: { lt: CUTOFF } },
      data: { financeStatus: "APPROVED", financeNote: "Recorded before finance verification was introduced" },
    }),
    prisma.fieldPayment.updateMany({
      where: { financeStatus: "PENDING", createdAt: { lt: CUTOFF } },
      data: { financeStatus: "APPROVED", financeNote: "Recorded before finance verification was introduced" },
    }),
  ]);
  console.log(`✓ backfilled ${sales.count} sales + ${payments.count} collections created before ${CUTOFF.toISOString()} → APPROVED`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

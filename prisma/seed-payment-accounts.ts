/**
 * Seed ORA's real company receiving accounts (idempotent — safe to re-run).
 *
 *   Cash          → Cash Payment (no extra details)
 *   Bank          → NMB Bank · ORA Sanitary Pads · 24110012629
 *   Mobile money  → Voda · ORA Sanitary Pads · Lipa 58198034
 *
 * Also retires old placeholder/dev accounts: deleted when nothing references
 * them, deactivated otherwise (history stays intact).
 *
 * Run:  npx tsx prisma/seed-payment-accounts.ts
 * Neon: DATABASE_URL=<neon> DIRECT_URL=<neon> npx tsx prisma/seed-payment-accounts.ts
 */
import { PrismaClient, PaymentAccountType } from "@prisma/client";

const prisma = new PrismaClient();

const REAL_ACCOUNTS: {
  name: string;
  type: PaymentAccountType;
  accountName: string | null;
  accountNumber: string | null;
}[] = [
  { name: "Cash", type: "CASH", accountName: null, accountNumber: null },
  {
    name: "NMB Bank",
    type: "BANK",
    accountName: "ORA Sanitary Pads",
    accountNumber: "24110012629",
  },
  {
    name: "Voda",
    type: "MOBILE_MONEY",
    accountName: "ORA Sanitary Pads",
    accountNumber: "58198034",
  },
];

async function main() {
  for (const acc of REAL_ACCOUNTS) {
    const existing = await prisma.paymentAccount.findFirst({
      where: { type: acc.type, name: acc.name },
    });
    if (existing) {
      await prisma.paymentAccount.update({
        where: { id: existing.id },
        data: {
          accountName: acc.accountName,
          accountNumber: acc.accountNumber,
          isActive: true,
        },
      });
      console.log(`✓ updated  ${acc.type.padEnd(12)} ${acc.name}`);
    } else {
      await prisma.paymentAccount.create({ data: acc });
      console.log(`✓ created  ${acc.type.padEnd(12)} ${acc.name}`);
    }
  }

  // Retire ONLY the known dev placeholders — admin-created accounts are
  // never touched, so re-running this after go-live is always safe.
  const DEV_PLACEHOLDERS = new Set([
    "CASH:Main Cash Office",
    "BANK:CRDB Bank",
    "MOBILE_MONEY:M-Pesa Lipa",
  ]);
  const others = await prisma.paymentAccount.findMany({
    include: {
      _count: {
        select: {
          fieldSales: true,
          fieldPayments: true,
          payments: true,
          settlementRequests: true,
          requests: true,
        },
      },
    },
  });
  for (const o of others) {
    if (!DEV_PLACEHOLDERS.has(`${o.type}:${o.name}`)) continue;
    const refs =
      o._count.fieldSales +
      o._count.fieldPayments +
      o._count.payments +
      o._count.settlementRequests +
      o._count.requests;
    if (refs === 0) {
      await prisma.paymentAccount.delete({ where: { id: o.id } });
      console.log(`✗ deleted  ${o.type.padEnd(12)} ${o.name} (unused placeholder)`);
    } else if (o.isActive) {
      await prisma.paymentAccount.update({
        where: { id: o.id },
        data: { isActive: false },
      });
      console.log(`– deactivated ${o.type.padEnd(12)} ${o.name} (${refs} linked records kept)`);
    }
  }

  const final = await prisma.paymentAccount.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  console.log("\nActive receiving accounts:");
  for (const a of final) {
    console.log(
      `  ${a.type.padEnd(12)} ${a.name}${a.accountName ? ` · ${a.accountName}` : ""}${a.accountNumber ? ` · ${a.accountNumber}` : ""}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

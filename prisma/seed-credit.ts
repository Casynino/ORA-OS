import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const partner = await prisma.user.findUnique({
    where: { email: "partner@orapads.org" },
  });
  const admin = await prisma.user.findUnique({
    where: { email: "admin@orapads.org" },
  });
  if (!partner || !admin) throw new Error("Demo users missing.");

  const [purple, blue, liner] = await Promise.all([
    prisma.product.findUnique({ where: { sku: "ORA-360" } }),
    prisma.product.findUnique({ where: { sku: "ORA-290" } }),
    prisma.product.findUnique({ where: { sku: "ORA-180" } }),
  ]);
  if (!purple || !blue || !liner) throw new Error("Products missing.");

  // Brian's agreed prices: Purple 3500, Blue 3500, Liner 3000.
  // termsDays = agreed pay-later window; createdAt = dueDate − termsDays.
  const accounts = [
    {
      code: "REQ-CR-01",
      product: purple,
      unit: 3500,
      qty: 25, // 87,500
      paid: 30000,
      status: "OUTSTANDING" as const,
      termsDays: 30,
      dueOffset: +20 * DAY,
      payments: [{ amount: 30000, method: "Mobile money", agoDays: 6, note: "Deposit on collection" }],
    },
    {
      code: "REQ-CR-02",
      product: blue,
      unit: 3500,
      qty: 15, // 52,500 — fully repaid (history)
      paid: 52500,
      status: "SETTLED" as const,
      termsDays: 30,
      dueOffset: -20 * DAY,
      payments: [
        { amount: 20000, method: "Bank transfer", agoDays: 40, note: "Part payment" },
        { amount: 32500, method: "Mobile money", agoDays: 28, note: "Final settlement" },
      ],
    },
    {
      code: "REQ-CR-03",
      product: liner,
      unit: 3000,
      qty: 20, // 60,000
      paid: 60000,
      status: "SETTLED" as const,
      termsDays: 30,
      dueOffset: -30 * DAY,
      payments: [
        { amount: 40000, method: "Mobile money", agoDays: 50, note: "First instalment" },
        { amount: 20000, method: "Cash", agoDays: 40, note: "Final settlement" },
      ],
    },
  ];

  for (const a of accounts) {
    // Re-runnable: drop any prior copy (cascades to items, credit account, payments).
    await prisma.request.deleteMany({ where: { code: a.code } });

    const principal = a.unit * a.qty;
    const dueDate = new Date(Date.now() + a.dueOffset);
    const createdAt = new Date(dueDate.getTime() - a.termsDays * DAY);

    const request = await prisma.request.create({
      data: {
        code: a.code,
        type: "AGENT_STOCK",
        status: "FULFILLED",
        paymentType: "CREDIT",
        requesterId: partner.id,
        warehouseName: "Dar es Salaam — Main",
        totalAmount: principal,
        paymentStatus: "OUTSTANDING",
        invoiceNo: a.code.replace("REQ", "INV"),
        reviewedById: admin.id,
        reviewedAt: createdAt,
        fulfilledAt: createdAt,
        deliveredAt: createdAt,
        createdAt,
        items: {
          create: [
            {
              productId: a.product.id,
              quantity: a.qty,
              unitPrice: a.unit,
              lineTotal: principal,
            },
          ],
        },
      },
    });

    const account = await prisma.creditAccount.create({
      data: {
        requestId: request.id,
        agentId: partner.id,
        principal,
        amountPaid: a.paid,
        status: a.status,
        dueDate,
        approvedById: admin.id,
        createdAt,
        payments: {
          create: a.payments.map((p) => ({
            amount: p.amount,
            method: p.method,
            note: p.note,
            recordedById: admin.id,
            createdAt: new Date(Date.now() - p.agoDays * DAY),
          })),
        },
      },
    });
    console.log(
      `✓ ${a.code} — ${a.status} principal ${principal} paid ${a.paid} (account ${account.id})`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

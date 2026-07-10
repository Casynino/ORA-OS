import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const partner = await prisma.user.findUnique({ where: { email: "partner@orapads.org" } });
  const admin = await prisma.user.findUnique({ where: { email: "admin@orapads.org" } });
  const main = await prisma.warehouse.findFirst({ where: { name: { contains: "Main" } } });
  if (!partner || !admin || !main) throw new Error("Need partner, admin, main warehouse.");

  const [purple, blue, liner] = await Promise.all([
    prisma.product.findUnique({ where: { sku: "ORA-360" } }),
    prisma.product.findUnique({ where: { sku: "ORA-290" } }),
    prisma.product.findUnique({ where: { sku: "ORA-180" } }),
  ]);
  if (!purple || !blue || !liner) throw new Error("Products missing.");

  // Brian's agreed prices.
  const PRICE = { [purple.id]: 3500, [blue.id]: 3500, [liner.id]: 3000 };
  const line = (pid: string, qty: number) => ({
    productId: pid,
    quantity: qty,
    unitPrice: PRICE[pid],
    lineTotal: PRICE[pid] * qty,
  });

  const orders = [
    {
      code: "REQ-WH-01",
      status: "APPROVED" as const,
      items: [line(blue.id, 30), line(purple.id, 10)], // 140,000
      deliverTo: "Otieno Distributors",
      deliveryAddress: "Plot 14, Nyerere Road, Kariakoo, Dar es Salaam",
      contactName: "Brian Otieno",
      contactPhone: "+255 712 445 901",
    },
    {
      code: "REQ-WH-02",
      status: "IN_TRANSIT" as const,
      items: [line(liner.id, 20)], // 60,000
      deliverTo: "Jangwani Secondary School",
      deliveryAddress: "Jangwani St, Kinondoni, Dar es Salaam",
      contactName: "Mwl. Fatuma Said",
      contactPhone: "+255 754 220 118",
    },
  ];

  for (const o of orders) {
    await prisma.request.deleteMany({ where: { code: o.code } });
    const total = o.items.reduce((s, i) => s + i.lineTotal, 0);
    await prisma.request.create({
      data: {
        code: o.code,
        type: "AGENT_STOCK",
        status: o.status,
        paymentType: "IMMEDIATE",
        paymentStatus: "UNPAID",
        requesterId: partner.id,
        warehouseName: main.name,
        deliverTo: o.deliverTo,
        deliveryAddress: o.deliveryAddress,
        contactName: o.contactName,
        contactPhone: o.contactPhone,
        deliverBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        reviewedById: admin.id,
        reviewedAt: new Date(),
        invoiceNo: o.code.replace("REQ", "INV"),
        totalAmount: total,
        items: { create: o.items },
      },
    });
    console.log(`✓ ${o.code} — ${o.status} · ${total} → ${o.deliverTo}.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

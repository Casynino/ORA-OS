import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { createdAt: "asc" } });
  const main = warehouses.find((w) => /main/i.test(w.name)) ?? warehouses[0];
  const second = warehouses.find((w) => w.id !== main?.id);
  if (!main) throw new Error("No warehouse found.");

  // Capacities + status
  await prisma.warehouse.update({
    where: { id: main.id },
    data: { capacity: 5000, status: "ACTIVE" },
  });
  if (second) {
    await prisma.warehouse.update({
      where: { id: second.id },
      data: { capacity: 2000, status: "ACTIVE" },
    });
  }

  const products = await prisma.product.findMany({
    include: { inventory: true },
  });

  for (const p of products) {
    const total = p.inventory?.warehouseQty ?? 0;
    const minLevel = p.inventory?.lowStockThreshold ?? 50;
    // Split the org total across locations so Σ on-hand == org total.
    const mwanza = second ? Math.floor(total * 0.25) : 0;
    const mainQty = total - mwanza;

    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: main.id, productId: p.id } },
      update: { onHand: mainQty, minLevel, lastMoveAt: new Date() },
      create: {
        warehouseId: main.id,
        productId: p.id,
        onHand: mainQty,
        minLevel,
        lastMoveAt: new Date(),
      },
    });
    if (second) {
      await prisma.warehouseStock.upsert({
        where: {
          warehouseId_productId: { warehouseId: second.id, productId: p.id },
        },
        update: { onHand: mwanza, minLevel, lastMoveAt: new Date() },
        create: {
          warehouseId: second.id,
          productId: p.id,
          onHand: mwanza,
          minLevel,
          lastMoveAt: new Date(),
        },
      });
    }
    console.log(`• ${p.name}: ${mainQty} @ ${main.name}` + (second ? ` · ${mwanza} @ ${second.name}` : ""));
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

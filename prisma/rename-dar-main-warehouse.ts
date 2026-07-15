/**
 * Rename the primary warehouse to "Dar Main Warehouse" and cascade the label
 * to every denormalised string reference so nothing orphans. Idempotent.
 *
 * The app routes orders/returns and scopes warehouse staff by NAME (denormalised
 * Request.warehouseName / ReturnRequest.warehouseName / User.assignedWarehouse /
 * StockMovement.warehouseName), so a plain Warehouse.name change would break
 * those joins — this updates them together in one transaction.
 *
 * Run:  npx tsx prisma/rename-dar-main-warehouse.ts
 * Neon: DATABASE_URL=<neon> DIRECT_URL=<neon> npx tsx prisma/rename-dar-main-warehouse.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET = "Dar Main Warehouse";

async function main() {
  // Find the current main warehouse: exact target if it already exists,
  // else the oldest one whose name contains "Main", else the oldest overall.
  const existingTarget = await prisma.warehouse.findFirst({
    where: { name: TARGET },
  });
  const main =
    existingTarget ??
    (await prisma.warehouse.findFirst({
      where: { name: { contains: "Main" } },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.warehouse.findFirst({ orderBy: { createdAt: "asc" } }));

  if (!main) {
    console.log("No warehouse found — nothing to rename.");
    return;
  }
  const oldName = main.name;
  if (oldName === TARGET) {
    console.log(`✓ Warehouse already named "${TARGET}" — verifying references…`);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.warehouse.update({
      where: { id: main.id },
      data: { name: TARGET, location: main.location ?? "Dar es Salaam" },
    });
    const [reqs, rets, users, moves, issues] = await Promise.all([
      tx.request.updateMany({
        where: { warehouseName: oldName },
        data: { warehouseName: TARGET },
      }),
      tx.returnRequest.updateMany({
        where: { warehouseName: oldName },
        data: { warehouseName: TARGET },
      }),
      tx.user.updateMany({
        where: { assignedWarehouse: oldName },
        data: { assignedWarehouse: TARGET },
      }),
      tx.stockMovement.updateMany({
        where: { warehouseName: oldName },
        data: { warehouseName: TARGET },
      }),
      tx.repStockIssue.updateMany({
        where: { warehouseName: oldName },
        data: { warehouseName: TARGET },
      }),
    ]);
    return {
      reqs: reqs.count,
      rets: rets.count,
      users: users.count,
      moves: moves.count,
      issues: issues.count,
    };
  });

  console.log(`✓ Renamed "${oldName}" → "${TARGET}"`);
  console.log(
    `  cascaded: ${result.reqs} orders · ${result.rets} returns · ${result.users} partner default warehouses · ${result.moves} movements · ${result.issues} rep issues`,
  );

  const staff = await prisma.user.findMany({
    where: { role: "WAREHOUSE" },
    select: { name: true, email: true, warehouse: { select: { name: true } } },
  });
  console.log("\nWarehouse staff:");
  for (const s of staff) {
    console.log(`  ${s.name} <${s.email}> → ${s.warehouse?.name ?? "(unassigned)"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

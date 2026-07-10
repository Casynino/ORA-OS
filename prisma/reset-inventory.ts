/**
 * ORA OS — Day-1 Production Inventory Reset
 * ==========================================
 * Wipes all demo/test transactional data and stands the inventory up with the
 * real opening stock. Idempotent: safe to run more than once.
 *
 *   Run local:  tsx prisma/reset-inventory.ts
 *   Run Neon:   DATABASE_URL="<neon-url>" tsx prisma/reset-inventory.ts
 *
 * PRESERVED (never touched):
 *   Users · LoginEvents · Stockists · Impact (activities/stories) · Education ·
 *   News · Donation archive · Expenses/Capital · Contact messages · Cycle logs ·
 *   Settings. Products are renamed, not deleted. One "Main Warehouse" is kept.
 *
 * WIPED (demo/test only — there is no real data of these kinds yet):
 *   Field sales/payments/customers/reports · Samples · Rep stock/issues/requests ·
 *   Rep targets · Partner orders (requests) · Credit accounts/payments/settlements ·
 *   Returns · Stock movements · Warehouse stock/transfers · Inventory snapshots ·
 *   Per-partner price overrides · demo stock-activity log entries.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── The 4 real products (source of truth) ───────────────────────────────────
// Stock is stored in PIECES. Cartons are a display unit (unitsPerCarton pieces).
type Seed = {
  legacySku: string | null; // old SKU to rename from (idempotent match)
  sku: string;
  name: string;
  description: string;
  category: "PADS" | "HYGIENE" | "ACCESSORY" | "OTHER";
  unitLabel: string;
  iconKey: string;
  unitsPerCarton: number;
  costPrice: number; // buying cost per piece (TSh)
  price: number; // selling price per piece (TSh) — 0 when notForSale
  notForSale: boolean;
  openingCartons: number;
  lowStockCartons: number; // low-stock alert threshold, in cartons
};

const PRODUCTS: Seed[] = [
  {
    legacySku: "ORA-PURPLE-360",
    sku: "ORA-360",
    name: "ORA Pads 360mm Purple Night",
    description:
      "Night Flow Protection — 360mm extra-long overnight coverage, 100% air-breathable.",
    category: "PADS",
    unitLabel: "360mm · Night Flow",
    iconKey: "purple",
    unitsPerCarton: 24,
    costPrice: 1500,
    price: 3000,
    notForSale: false,
    openingCartons: 1993,
    lowStockCartons: 20,
  },
  {
    legacySku: "ORA-BLUE-290",
    sku: "ORA-290",
    name: "ORA Pads 290mm Blue Day",
    description:
      "Day Flow Comfort — 290mm discreet, breathable daytime protection.",
    category: "PADS",
    unitLabel: "290mm · Day Flow",
    iconKey: "blue",
    unitsPerCarton: 24,
    costPrice: 1500,
    price: 3000,
    notForSale: false,
    openingCartons: 791,
    lowStockCartons: 20,
  },
  {
    legacySku: "ORA-LINER-180",
    sku: "ORA-180",
    name: "ORA Pant Liners 180mm",
    description: "Daily Freshness — 180mm light, breathable everyday liners.",
    category: "HYGIENE",
    unitLabel: "180mm · Daily",
    iconKey: "pink",
    unitsPerCarton: 24,
    costPrice: 1500,
    price: 3000,
    notForSale: false,
    openingCartons: 0,
    lowStockCartons: 20,
  },
  {
    legacySku: null,
    sku: "ORA-SAMPLE",
    name: "ORA Sample Pack",
    description:
      "Free outreach sample pack — used for demos, trials and school programmes. Not for sale.",
    category: "OTHER",
    unitLabel: "Sample · 600 per carton",
    iconKey: "sample",
    unitsPerCarton: 600,
    costPrice: 500,
    price: 0,
    notForSale: true,
    openingCartons: 42,
    lowStockCartons: 2,
  },
];

const MAIN_WAREHOUSE_NAME = "Main Warehouse";
const OPENING_REFERENCE = "Initial Inventory Setup";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`\n🧭 Target database host: ${host || "(unknown)"}\n`);

  // 1) Locate the admin who will own the opening-stock ledger entries.
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error("No ADMIN user found — cannot record opening stock. Aborting.");
  }
  console.log(`👤 Opening stock will be recorded by: ${admin.name}`);

  // 2) Wipe all transactional / demo data (FK-safe: children before parents).
  console.log("\n🧹 Clearing demo & test transactional data…");
  const wipes: [string, () => Promise<{ count: number }>][] = [
    ["field payments", () => prisma.fieldPayment.deleteMany()],
    ["field sale items", () => prisma.fieldSaleItem.deleteMany()],
    ["field sales", () => prisma.fieldSale.deleteMany()],
    ["samples", () => prisma.sampleLog.deleteMany()],
    ["field reports", () => prisma.fieldReport.deleteMany()],
    ["rep targets", () => prisma.repTarget.deleteMany()],
    ["field customers", () => prisma.fieldCustomer.deleteMany()],
    ["rep stock request items", () => prisma.repStockRequestItem.deleteMany()],
    ["rep stock requests", () => prisma.repStockRequest.deleteMany()],
    ["rep stock issues", () => prisma.repStockIssue.deleteMany()],
    ["rep stock", () => prisma.repStock.deleteMany()],
    ["payments", () => prisma.payment.deleteMany()],
    ["settlement requests", () => prisma.settlementRequest.deleteMany()],
    ["credit accounts", () => prisma.creditAccount.deleteMany()],
    // Cycle/growth history earned on the wiped demo accounts goes too (manual
    // LIMIT_SET events stay — that's real commercial-terms audit, like the
    // limit itself). Scores/cycles reset to match the now-empty ledger.
    [
      "credit growth events",
      () =>
        prisma.partnerCreditEvent.deleteMany({
          where: { type: { in: ["CYCLE_COMPLETED", "LIMIT_INCREASE"] } },
        }),
    ],
    ["returns", () => prisma.returnRequest.deleteMany()],
    ["stock movements", () => prisma.stockMovement.deleteMany()],
    ["order items", () => prisma.requestItem.deleteMany()],
    ["orders", () => prisma.request.deleteMany()],
    ["warehouse transfer items", () => prisma.warehouseTransferItem.deleteMany()],
    ["warehouse transfers", () => prisma.warehouseTransfer.deleteMany()],
    ["warehouse stock", () => prisma.warehouseStock.deleteMany()],
    ["inventory snapshots", () => prisma.inventory.deleteMany()],
    ["partner price overrides", () => prisma.partnerPrice.deleteMany()],
  ];
  for (const [label, run] of wipes) {
    const { count } = await run();
    console.log(`   • ${label.padEnd(26)} ${count} removed`);
  }

  // Purge only demo transactional activity-log entries; keep the real audit
  // trail (profile, impact, stockist, education, news events).
  const purgedLog = await prisma.activityLog.deleteMany({
    where: {
      entity: {
        in: [
          "Inventory",
          "Product",
          "Request",
          "Payment",
          "ReturnRequest",
          "CreditAccount",
          "SettlementRequest",
          "FieldSale",
          "RepStock",
          "RepStockRequest",
          "RepStockIssue",
          "FieldReport",
          "FieldCustomer",
          "WarehouseTransfer",
          "SampleLog",
        ],
      },
    },
  });
  console.log(`   • ${"stock activity log".padEnd(26)} ${purgedLog.count} removed`);

  // Credit scores/cycles were earned on the demo ledger — reset with it.
  const scoreReset = await prisma.user.updateMany({
    where: { role: "PARTNER" },
    data: { creditScore: 0, creditCycles: 0 },
  });
  console.log(`   • ${"partner credit scores".padEnd(26)} ${scoreReset.count} reset`);

  // 3) Consolidate to a single "Main Warehouse".
  console.log("\n🏬 Consolidating to one warehouse…");
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: "asc" },
  });
  let mainId: string;
  if (warehouses.length === 0) {
    const created = await prisma.warehouse.create({
      data: {
        name: MAIN_WAREHOUSE_NAME,
        location: "Dar es Salaam",
        isActive: true,
        status: "ACTIVE",
      },
    });
    mainId = created.id;
    console.log(`   • Created "${MAIN_WAREHOUSE_NAME}"`);
  } else {
    const preferred =
      warehouses.find((w) => /main/i.test(w.name)) ?? warehouses[0];
    mainId = preferred.id;
    await prisma.warehouse.update({
      where: { id: mainId },
      data: {
        name: MAIN_WAREHOUSE_NAME,
        location: "Dar es Salaam",
        isActive: true,
        status: "ACTIVE",
      },
    });
    console.log(`   • Kept & renamed "${preferred.name}" → "${MAIN_WAREHOUSE_NAME}"`);
    // Move any warehouse staff onto Main, then remove the extra warehouses.
    await prisma.user.updateMany({
      where: { warehouseId: { not: mainId } },
      data: { warehouseId: mainId },
    });
    const extras = warehouses.filter((w) => w.id !== mainId);
    if (extras.length) {
      const del = await prisma.warehouse.deleteMany({
        where: { id: { in: extras.map((w) => w.id) } },
      });
      console.log(`   • Removed ${del.count} extra warehouse(s)`);
    }
  }

  // 4) Upsert the 4 real products + stand up opening stock.
  console.log("\n📦 Setting up products & opening stock…");
  for (const s of PRODUCTS) {
    const openingPieces = s.openingCartons * s.unitsPerCarton;
    const lowThreshold = s.lowStockCartons * s.unitsPerCarton;

    // Find existing by legacy OR new SKU (idempotent across re-runs / renames).
    const skus = [s.sku, ...(s.legacySku ? [s.legacySku] : [])];
    const existing = await prisma.product.findFirst({
      where: { sku: { in: skus } },
    });

    const data = {
      sku: s.sku,
      name: s.name,
      description: s.description,
      category: s.category,
      unitLabel: s.unitLabel,
      iconKey: s.iconKey,
      unitsPerCarton: s.unitsPerCarton,
      costPrice: s.costPrice,
      price: s.price,
      notForSale: s.notForSale,
      isActive: true,
    };

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });

    // Fresh inventory snapshot — all stock lives in the Main warehouse.
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {
        warehouseQty: openingPieces,
        assignedQty: 0,
        distributedQty: 0,
        lowStockThreshold: lowThreshold,
      },
      create: {
        productId: product.id,
        warehouseQty: openingPieces,
        assignedQty: 0,
        distributedQty: 0,
        lowStockThreshold: lowThreshold,
      },
    });

    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: mainId, productId: product.id } },
      update: { onHand: openingPieces, reserved: 0, inTransit: 0, minLevel: lowThreshold },
      create: {
        warehouseId: mainId,
        productId: product.id,
        onHand: openingPieces,
        reserved: 0,
        inTransit: 0,
        minLevel: lowThreshold,
      },
    });

    // One opening-stock ledger entry per product that actually opens with stock.
    if (openingPieces > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: "INBOUND",
          quantity: openingPieces,
          reference: OPENING_REFERENCE,
          note: `Opening balance: ${s.openingCartons.toLocaleString()} cartons × ${s.unitsPerCarton} = ${openingPieces.toLocaleString()} pcs`,
          createdById: admin.id,
        },
      });
    }

    const cartons = openingPieces / s.unitsPerCarton;
    console.log(
      `   • ${s.sku.padEnd(11)} ${s.name.padEnd(30)} ${openingPieces
        .toLocaleString()
        .padStart(8)} pcs (${cartons.toLocaleString()} cartons)${
        s.notForSale ? "  [FREE]" : ""
      }`,
    );
  }

  // 5) Verify.
  console.log("\n✅ Verification");
  const products = await prisma.product.findMany({
    orderBy: { sku: "asc" },
    include: { inventory: true },
  });
  const movements = await prisma.stockMovement.count();
  const otherWarehouses = await prisma.warehouse.count();
  let totalPieces = 0;
  for (const p of products) {
    const qty = p.inventory?.warehouseQty ?? 0;
    totalPieces += qty;
  }
  console.log(`   Products:          ${products.length}`);
  console.log(`   Warehouses:        ${otherWarehouses}`);
  console.log(`   Opening movements: ${movements}`);
  console.log(`   Total pieces:      ${totalPieces.toLocaleString()}`);
  console.log(
    `   Total cartons:     ${products
      .reduce((n, p) => n + (p.inventory?.warehouseQty ?? 0) / p.unitsPerCarton, 0)
      .toLocaleString()}`,
  );

  const expected: Record<string, number> = {
    "ORA-360": 47832,
    "ORA-290": 18984,
    "ORA-180": 0,
    "ORA-SAMPLE": 25200,
  };
  let allOk = true;
  for (const [sku, want] of Object.entries(expected)) {
    const p = products.find((x) => x.sku === sku);
    const got = p?.inventory?.warehouseQty ?? -1;
    const ok = got === want;
    allOk = allOk && ok;
    console.log(`   ${ok ? "✓" : "✗"} ${sku.padEnd(11)} ${got.toLocaleString()} (expected ${want.toLocaleString()})`);
  }
  console.log(
    allOk
      ? "\n🎉 Opening inventory initialised correctly.\n"
      : "\n⚠️  Counts do not match expected values — review above.\n",
  );
}

main()
  .catch((e) => {
    console.error("❌ Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

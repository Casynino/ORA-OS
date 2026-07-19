// Set ORA's official starting selling prices (per piece, TSh). Idempotent —
// updates the canonical Product.price by SKU. Carton price is derived
// (price × unitsPerCarton). Sample pack stays not-for-sale (price 0).
//   ORA-360  ORA Pads 360mm     → 2,800/pc  (carton 24 → 67,200)
//   ORA-290  ORA Pads 290mm     → 2,800/pc  (carton 24 → 67,200)
//   ORA-180  ORA Pant Liners    → 2,500/pc  (carton 24 → 60,000)
//
// Local:  node scripts/set-official-prices.mjs
// Neon:   DATABASE_URL=<neon-url> node scripts/set-official-prices.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const OFFICIAL = { "ORA-360": 2800, "ORA-290": 2800, "ORA-180": 2500 };
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(local)";

try {
  console.log(`→ Setting official prices on ${host}`);
  for (const [sku, price] of Object.entries(OFFICIAL)) {
    const before = await p.product.findUnique({ where: { sku }, select: { name: true, price: true, unitsPerCarton: true } });
    if (!before) { console.log(`  · ${sku}: NOT FOUND — skipped`); continue; }
    await p.product.update({ where: { sku }, data: { price } });
    const carton = price * before.unitsPerCarton;
    console.log(`  ✓ ${sku} ${before.name}: ${before.price} → ${price}/pc (carton ${before.unitsPerCarton} → ${carton.toLocaleString()})`);
  }
  // Safety: ensure the sample pack is never for sale.
  const sample = await p.product.updateMany({ where: { sku: "ORA-SAMPLE" }, data: { price: 0, notForSale: true } });
  if (sample.count) console.log(`  ✓ ORA-SAMPLE: price 0, notForSale true`);
  console.log("✓ Done.");
} catch (e) {
  console.error("✗ Failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function reset() {
  await prisma.payment.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.requestItem.deleteMany();
  await prisma.returnRequest.deleteMany();
  await prisma.request.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.donationPackage.deleteMany();
  await prisma.cycleLog.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.educationContent.deleteMany();
  await prisma.impactStory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.warehouse.deleteMany();
}

async function main() {
  console.log("🌱  Seeding Ora OS (real, locked product set)…");
  await reset();
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const mainWarehouse = await prisma.warehouse.create({
    data: { name: "Dar es Salaam — Main", location: "Dar es Salaam" },
  });
  await prisma.warehouse.create({
    data: { name: "Mwanza — Lake Zone", location: "Mwanza" },
  });

  const admin = await prisma.user.create({
    data: { name: "ORA Admin", email: "admin@orapads.org", passwordHash: hash("Admin@123"), role: "ADMIN", status: "ACTIVE", phone: "+255700000001" },
  });
  await prisma.user.create({
    data: { name: "Juma Warehouse", email: "warehouse@orapads.org", passwordHash: hash("Warehouse@123"), role: "WAREHOUSE", status: "ACTIVE", warehouseId: mainWarehouse.id },
  });
  const partner = await prisma.user.create({
    data: {
      name: "Brian Otieno", email: "partner@orapads.org", passwordHash: hash("Partner@123"),
      role: "PARTNER", status: "ACTIVE", organization: "Otieno Distributors",
      businessType: "Distributor", phone: "+255 712 445 901",
      region: "Dar es Salaam", district: "Kinondoni", street: "Plot 14, Nyerere Road, Kariakoo",
      location: "Plot 14, Nyerere Road, Kariakoo, Kinondoni, Dar es Salaam",
      taxId: "112-233-445", businessLicense: "BRELA-2021-00891", expectedVolume: "800 packs",
      preferredPayment: "Credit", paymentTerms: "Net 30", creditLimit: 200000,
    },
  });
  const partner2 = await prisma.user.create({
    data: {
      name: "Grace Mwangi", email: "grace@orapads.org", passwordHash: hash("Partner@123"),
      role: "PARTNER", status: "ACTIVE", organization: "Mwangi Health Supplies",
      businessType: "Retailer", phone: "+255 755 112 233",
      region: "Mwanza", district: "Nyamagana", street: "Plot 9, Kenyatta Road",
      location: "Plot 9, Kenyatta Road, Nyamagana, Mwanza",
      taxId: "223-344-556", businessLicense: "BRELA-2022-01337", expectedVolume: "400 packs",
      preferredPayment: "Credit", paymentTerms: "Net 14", creditLimit: 150000,
    },
  });
  await prisma.user.create({
    data: {
      name: "Peter Kamau", email: "applicant@orapads.org", passwordHash: hash("Partner@123"),
      role: "PARTNER", status: "PENDING", organization: "Kamau Ventures",
      businessType: "Agent", phone: "+255 689 770 540",
      region: "Arusha", district: "Arusha Urban", street: "Sokoine Road, Kati",
      location: "Sokoine Road, Kati, Arusha Urban, Arusha",
      taxId: "334-455-667", expectedVolume: "300 packs", preferredPayment: "Credit",
    },
  });

  // ── The ONLY 3 real Ora products (system-locked) ───────────────────────────
  const productSeed = [
    { sku: "ORA-PURPLE-360", name: "Ora Pads 360mm — Purple", category: "PADS", unitLabel: "360mm · Night Flow", desc: "Night Flow Protection — full overnight coverage, 100% air breathable.", iconKey: "purple", cost: 2000, price: 3500, stock: 150 },
    { sku: "ORA-BLUE-290", name: "Ora Pads 290mm — Blue", category: "PADS", unitLabel: "290mm · Day Flow", desc: "Day Flow Comfort — discreet, breathable daytime protection.", iconKey: "blue", cost: 2000, price: 3500, stock: 150 },
    { sku: "ORA-LINER-180", name: "Ora Pant Liners 180mm", category: "HYGIENE", unitLabel: "180mm · Daily", desc: "Daily Freshness — light, breathable everyday liners.", iconKey: "pink", cost: 1800, price: 3000, stock: 200 },
  ] as const;

  const products: { id: string; sku: string }[] = [];
  for (const p of productSeed) {
    const created = await prisma.product.create({
      data: {
        sku: p.sku, name: p.name, description: p.desc, category: p.category,
        unitLabel: p.unitLabel, iconKey: p.iconKey, costPrice: p.cost, price: p.price,
        inventory: { create: { warehouseQty: p.stock, lowStockThreshold: 40 } },
      },
    });
    products.push({ id: created.id, sku: created.sku });
    await prisma.stockMovement.create({
      data: { productId: created.id, type: "INBOUND", quantity: p.stock, reference: "Opening stock", createdById: admin.id },
    });
  }
  const P = (sku: string) => products.find((x) => x.sku === sku)!.id;

  // ── Donation packages (pad-sponsorship tiers) ──────────────────────────────
  // Real donations only — collected live via the NTZS mobile-money rail.
  await prisma.donationPackage.createMany({
    data: [
      { name: "Sponsor 10 Pads",  description: "Protect one girl this month.",       type: "PADS", padsQuantity: 10,  sortOrder: 1 },
      { name: "Sponsor 25 Pads",  description: "Keep a girl in school all term.",     type: "PADS", padsQuantity: 25,  sortOrder: 2 },
      { name: "Sponsor 50 Pads",  description: "A full term of dignity for one girl.", type: "PADS", padsQuantity: 50,  sortOrder: 3 },
      { name: "Sponsor 100 Pads", description: "Reach a whole classroom of girls.",    type: "PADS", padsQuantity: 100, sortOrder: 4 },
    ],
  });

  const articles = [
    { slug: "understanding-your-menstrual-cycle", title: "Understanding Your Menstrual Cycle", excerpt: "A simple guide to the phases of your cycle and what's normal.", category: "MENSTRUAL_HEALTH", language: "EN", readMinutes: 4, body: "Your menstrual cycle is your body's monthly rhythm, usually lasting between 21 and 35 days.\n\nThe cycle has four phases: menstruation, the follicular phase, ovulation and the luteal phase.\n\nTracking your cycle helps you understand your body and predict your period." },
    { slug: "staying-clean-and-confident", title: "Staying Clean and Confident on Your Period", excerpt: "Practical hygiene tips for comfort and confidence.", category: "HYGIENE", language: "EN", readMinutes: 3, body: "Change your pad every 4 to 6 hours to stay fresh and prevent irritation.\n\nWash your hands before and after changing.\n\nCarry a small kit with spare pads so you never miss school." },
    { slug: "myths-vs-facts", title: "Period Myths vs Facts", excerpt: "Busting the most common menstruation myths.", category: "MYTHS_FACTS", language: "EN", readMinutes: 3, body: "Myth: You can't exercise on your period. Fact: Gentle movement eases cramps.\n\nMyth: Periods are shameful. Fact: Menstruation is healthy and natural." },
    { slug: "kuelewa-mzunguko-wako", title: "Kuelewa Mzunguko Wako wa Hedhi", excerpt: "Mwongozo rahisi kuhusu awamu za mzunguko wa hedhi.", category: "MENSTRUAL_HEALTH", language: "SW", readMinutes: 4, body: "Mzunguko wa hedhi ni mdundo wa mwili wako wa kila mwezi, kwa kawaida huchukua siku 21 hadi 35.\n\nKufuatilia mzunguko wako hukusaidia kuelewa mwili wako." },
    { slug: "usafi-na-kujiamini", title: "Usafi na Kujiamini Wakati wa Hedhi", excerpt: "Vidokezo vya usafi kwa faraja na kujiamini.", category: "HYGIENE", language: "SW", readMinutes: 3, body: "Badilisha pedi kila baada ya saa 4 hadi 6 ili kubaki safi.\n\nNawa mikono kabla na baada ya kubadilisha." },
    { slug: "supporting-girls-in-school", title: "Why Period Support Keeps Girls in School", excerpt: "The link between menstrual products and education.", category: "COMMUNITY_STORY", language: "EN", readMinutes: 3, body: "Many girls miss school days every month for lack of products.\n\nWhen pads are available, attendance and confidence rise." },
  ] as const;
  for (const a of articles) await prisma.educationContent.create({ data: { ...a, authorId: admin.id, published: true } });

  await prisma.impactStory.createMany({
    data: [
      { slug: "amina-stays-in-school", title: "Amina stays in school", personName: "Amina, Form 2", location: "Jangwani Secondary School, Dar es Salaam", quote: "Now I never miss class during my period.", body: "Since ORA reached Jangwani, I have the pads and the knowledge to manage my period with confidence — I no longer stay home.", sortOrder: 1 },
      { slug: "neema-speaks-up", title: "Neema speaks up", personName: "Neema, Form 3", location: "Jangwani Secondary School, Dar es Salaam", quote: "I'm not ashamed anymore.", body: "The ORA sessions taught us that periods are normal. Now my friends and I talk openly and support one another.", sortOrder: 2 },
      { slug: "zawadi-can-focus", title: "Zawadi can focus", personName: "Zawadi, Form 1", location: "Jangwani Secondary School, Dar es Salaam", quote: "ORA made school feel possible again.", body: "I used to worry every single month. With ORA pads I can now focus on my studies instead of hiding.", sortOrder: 3 },
      { slug: "happy-walks-tall", title: "Happy walks tall", personName: "Happy, Form 4", location: "Jangwani Secondary School, Dar es Salaam", quote: "I walk into exams with my head held high.", body: "Knowing I'm prepared every day of the month means I can give my full attention to my future.", sortOrder: 4 },
    ],
  });

  // ── Real partner requests (quantities fit real stock) ──────────────────────
  await prisma.request.create({
    data: { code: "REQ-1001", type: "AGENT_STOCK", status: "PENDING", paymentType: "IMMEDIATE", requesterId: partner.id, note: "For a school outreach in Kisumu.",
      items: { create: [{ productId: P("ORA-PURPLE-360"), quantity: 20 }, { productId: P("ORA-LINER-180"), quantity: 10 }] } },
  });
  await prisma.request.create({
    data: { code: "REQ-1002", type: "AGENT_STOCK", status: "PRICED", paymentType: "IMMEDIATE", requesterId: partner.id, totalAmount: 52500, reviewedById: admin.id, reviewedAt: new Date(),
      items: { create: [{ productId: P("ORA-BLUE-290"), quantity: 15, unitPrice: 3500, lineTotal: 52500 }] } },
  });
  const creditReq = await prisma.request.create({
    data: { code: "REQ-1003", type: "AGENT_STOCK", status: "APPROVED", paymentType: "CREDIT", requesterId: partner2.id, totalAmount: 105000, reviewedById: admin.id, reviewedAt: new Date(),
      items: { create: [{ productId: P("ORA-BLUE-290"), quantity: 30, unitPrice: 3500, lineTotal: 105000 }] } },
  });
  await prisma.inventory.update({ where: { productId: P("ORA-BLUE-290") }, data: { warehouseQty: { decrement: 30 }, assignedQty: { increment: 30 } } });
  await prisma.stockMovement.create({ data: { productId: P("ORA-BLUE-290"), type: "ASSIGNED", quantity: 30, requestId: creditReq.id, reference: creditReq.code, createdById: admin.id } });
  const credit = await prisma.creditAccount.create({ data: { requestId: creditReq.id, agentId: partner2.id, principal: 105000, amountPaid: 40000, status: "PARTIAL", approvedById: admin.id, dueDate: new Date(Date.now() + 30 * 86400000) } });
  await prisma.payment.create({ data: { creditAccountId: credit.id, amount: 40000, method: "Mobile money", recordedById: admin.id } });

  const fulfilled = await prisma.request.create({
    data: { code: "REQ-1004", type: "AGENT_STOCK", status: "FULFILLED", paymentType: "IMMEDIATE", requesterId: partner.id, totalAmount: 87500, reviewedById: admin.id, reviewedAt: new Date(Date.now() - 3 * 86400000), fulfilledAt: new Date(),
      items: { create: [{ productId: P("ORA-PURPLE-360"), quantity: 25, unitPrice: 3500, lineTotal: 87500 }] } },
  });
  await prisma.inventory.update({ where: { productId: P("ORA-PURPLE-360") }, data: { warehouseQty: { decrement: 25 }, distributedQty: { increment: 25 } } });
  await prisma.stockMovement.create({ data: { productId: P("ORA-PURPLE-360"), type: "DISTRIBUTED", quantity: 25, requestId: fulfilled.id, reference: fulfilled.code, createdById: admin.id } });

  // Mirror opening stock into the per-warehouse location ledger so the
  // invariant holds from the start: Σ WarehouseStock.onHand == Inventory.warehouseQty
  // (and reserved == assignedQty). All opening stock lands in the Main warehouse.
  for (const pr of products) {
    const i = await prisma.inventory.findUnique({ where: { productId: pr.id } });
    if (!i) continue;
    await prisma.warehouseStock.create({
      data: {
        warehouseId: mainWarehouse.id,
        productId: pr.id,
        onHand: i.warehouseQty,
        reserved: i.assignedQty,
        inTransit: 0,
        minLevel: 40,
        lastMoveAt: new Date(),
      },
    });
  }

  await prisma.returnRequest.create({ data: { code: "RET-1001", productId: P("ORA-LINER-180"), requesterId: partner.id, quantity: 8, reason: "Surplus from a cancelled outreach.", status: "PENDING" } });

  await prisma.activityLog.createMany({
    data: [
      { actorId: admin.id, actorName: admin.name, action: "REQUEST_FULFILLED", entity: "Request", entityId: fulfilled.id, summary: `Request ${fulfilled.code} fulfilled — 25 × Purple distributed.` },
      { actorId: admin.id, actorName: admin.name, action: "REQUEST_APPROVED", entity: "Request", entityId: creditReq.id, summary: `Request ${creditReq.code} approved for Grace Mwangi (credit).` },
      { actorId: admin.id, actorName: admin.name, action: "CREDIT_PAYMENT_RECORDED", entity: "CreditAccount", entityId: credit.id, summary: `Payment of 40000 recorded against ${creditReq.code} (partial).` },
    ],
  });

  await prisma.setting.create({ data: { key: "org.name", value: "Ora Pads" } });

  console.log("✅  Seed complete — 3 real products (150/150/200 = 500 units).");
  console.log("   Admin     → admin@orapads.org / Admin@123");
  console.log("   Warehouse → warehouse@orapads.org / Warehouse@123");
  console.log("   Partner   → partner@orapads.org / Partner@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

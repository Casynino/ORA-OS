import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, Info } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { saleEditBlocker } from "@/lib/services/sale-edit";
import { PageHeader } from "@/components/ui/page-header";
import { FieldSaleForm, type SaleEditMode } from "@/components/field/sale-form";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const METHOD_KEY: Record<string, string> = {
  Cash: "CASH",
  "Bank Transfer": "BANK",
  "Mobile Money": "MOBILE_MONEY",
  Cheque: "CHEQUE",
};
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("SALES_REP");
  const { id } = await params;

  const sale = await prisma.fieldSale.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: { select: { name: true, businessName: true } } },
  });
  if (!sale || sale.repId !== me.id) notFound();

  const back = (
    <Link href="/rep/sales" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>
      <ArrowLeft className="size-4" /> Sales history
    </Link>
  );
  const blocked = await saleEditBlocker(prisma, sale);
  if (blocked) {
    return (
      <div className="space-y-6">
        <PageHeader title={`Edit sale ${sale.code}`} description="This sale can't be edited right now.">
          {back}
        </PageHeader>
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>{blocked}</p>
        </div>
      </div>
    );
  }

  const [stock, customers, accounts, proofs] = await Promise.all([
    prisma.repStock.findMany({
      where: { repId: me.id },
      include: { product: true },
      orderBy: { product: { price: "desc" } },
    }),
    prisma.fieldCustomer.findMany({
      where: { repId: me.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, businessName: true, phone: true, location: true, creditSuspended: true, creditLimit: true },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
    prisma.attachment.count({ where: { entityType: "FieldSale", entityId: sale.id } }),
  ]);

  // What the rep can sell in this edit = what they hold now PLUS what this sale
  // already took out of their hands.
  const inSale = new Map<string, number>();
  for (const i of sale.items) inSale.set(i.productId, (inSale.get(i.productId) ?? 0) + i.quantity);
  const rows = new Map<string, { id: string; name: string; sku: string; unitLabel: string; price: number; inHand: number }>();
  for (const s of stock) {
    if (s.product.notForSale) continue;
    const inHand = s.sellableQty + (inSale.get(s.productId) ?? 0);
    if (inHand > 0) {
      rows.set(s.productId, { id: s.productId, name: s.product.name, sku: s.product.sku, unitLabel: s.product.unitLabel, price: s.product.price, inHand });
    }
  }
  for (const i of sale.items) {
    if (!rows.has(i.productId)) {
      rows.set(i.productId, { id: i.productId, name: i.product.name, sku: i.product.sku, unitLabel: i.product.unitLabel, price: i.product.price, inHand: inSale.get(i.productId) ?? 0 });
    }
  }
  const products = [...rows.values()].sort((a, b) => b.price - a.price);

  const acct = sale.paymentAccountId ? accounts.find((a) => a.id === sale.paymentAccountId) : undefined;
  const payMethod = acct?.type ?? METHOD_KEY[sale.paymentMethod ?? ""] ?? "CASH";
  const edit: SaleEditMode = {
    saleId: sale.id,
    code: sale.code,
    reconfirm: sale.financeStatus === "APPROVED",
    chequePhotoOnFile: sale.paymentMethod === "Cheque" && (proofs > 0 || !!sale.paymentProofUrl),
    initial: {
      type: sale.type,
      qty: Object.fromEntries([...inSale].map(([pid, q]) => [pid, String(q)])),
      price: Object.fromEntries(sale.items.map((i) => [i.productId, String(i.unitPrice)])),
      customerId: sale.customerId ?? "",
      customerName: sale.customerName ?? "",
      dueDate: day(sale.dueDate),
      note: sale.note ?? "",
      payMethod,
      payAccountId: acct?.id ?? "",
      reference: sale.reference ?? "",
      chequeBank: sale.chequeBank ?? "",
      chequeNumber: sale.chequeNumber ?? "",
      chequeDate: day(sale.chequeDate),
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit sale ${sale.code}`} description="Fix what was recorded wrong. Stock, totals and balances follow the new numbers.">
        {back}
      </PageHeader>

      <div className="flex items-start gap-3 rounded-2xl border border-info/40 bg-info/[0.06] p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p>
          {sale.financeStatus === "APPROVED" ? (
            <>
              Finance already confirmed this {sale.type === "CASH" ? "cash" : "credit"} sale of{" "}
              <strong>{formatCurrency(sale.total)}</strong>. When you save, that confirmation is withdrawn and Finance must confirm
              the corrected sale again{sale.type === "CASH" ? " — the cash leaves Cash on Hand until then" : ""}.
            </>
          ) : (
            <>
              This sale of <strong>{formatCurrency(sale.total)}</strong> is still waiting for Finance. Saving updates it in place and
              Finance sees the new numbers.
            </>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <FieldSaleForm products={products} customers={customers} accounts={accounts} edit={edit} />
      </div>
    </div>
  );
}

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { productMeta } from "@/lib/product-meta";
import {
  CreditLedger,
  type CreditAccountDTO,
  type SettlementDTO,
} from "@/components/admin/credit-ledger";

export default async function AdminCreditPage() {
  const settlementRows = await prisma.settlementRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      partner: { select: { name: true } },
      creditAccount: { include: { request: { select: { code: true } } } },
    },
  });
  const settlements: SettlementDTO[] = settlementRows.map((s) => ({
    id: s.id,
    code: s.code,
    partner: s.partner.name,
    batchCode: s.creditAccount.request.code,
    amount: s.amount,
    method: s.method,
    reference: s.reference,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
  }));

  const accounts = await prisma.creditAccount.findMany({
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: {
      request: {
        include: {
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      },
      agent: {
        select: { name: true, businessType: true, organization: true },
      },
      payments: {
        orderBy: { createdAt: "asc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });

  const dto: CreditAccountDTO[] = accounts.map((a) => {
    let running = 0;
    const payments = a.payments.map((p) => {
      running += p.amount;
      return {
        id: p.id,
        amount: p.amount,
        method: p.method,
        note: p.note,
        recordedBy: p.recordedBy.name,
        createdAt: p.createdAt.toISOString(),
        balanceAfter: Math.max(0, a.principal - running),
      };
    });
    return {
      id: a.id,
      code: a.request.code,
      invoiceNo: a.request.invoiceNo,
      partnerName: a.agent.name,
      partnerType: a.agent.businessType,
      partnerOrg: a.agent.organization,
      principal: a.principal,
      amountPaid: a.amountPaid,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      lastPaymentDate:
        a.payments.length > 0
          ? a.payments[a.payments.length - 1].createdAt.toISOString()
          : null,
      warehouse: a.request.warehouseName,
      issuedAt: a.request.fulfilledAt
        ? a.request.fulfilledAt.toISOString()
        : null,
      deliveredAt: a.request.deliveredAt
        ? a.request.deliveredAt.toISOString()
        : null,
      deliveryStatus: a.request.status,
      items: a.request.items.map((i) => ({
        name: i.product.name,
        size: productMeta(i.product.sku).size,
        quantity: i.quantity,
        unitPrice: i.unitPrice ?? 0,
        lineTotal: i.lineTotal ?? (i.unitPrice ?? 0) * i.quantity,
      })),
      payments,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit & Settlements"
        description="A live financial control ledger — every partner credit, repayment and overdue risk in one place."
      />
      <CreditLedger accounts={dto} settlements={settlements} />
    </div>
  );
}

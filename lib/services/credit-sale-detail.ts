import { prisma } from "@/lib/db";

export type CreditPaymentDTO = {
  amount: number;
  method: string | null;
  account: string | null;
  reference: string | null;
  /** Free-text context the collector added about this payment. */
  note: string | null;
  proofUrl: string | null;
  recordedBy: string;
  createdAt: string; // ISO
};

export type CreditSaleDetailDTO = {
  id: string;
  code: string;
  type: string;
  total: number;
  amountPaid: number;
  creditStatus: string | null;
  dueDate: string | null; // ISO
  createdAt: string; // ISO
  note: string | null;
  customerId: string | null;
  customerName: string;
  customerBusiness: string | null;
  customerPhone: string | null;
  customerLocation: string | null;
  creditSuspended: boolean;
  repName: string;
  repRegion: string | null;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  payments: CreditPaymentDTO[];
};

export type ReceivingAcct = {
  id: string;
  name: string;
  type: string;
  accountName: string | null;
  accountNumber: string | null;
};

/** One field-credit sale (a customer's debt) with its full collection history —
 *  shared by the finance and admin debt-detail pages. */
export async function getCreditSaleDetail(
  id: string,
): Promise<{ sale: CreditSaleDetailDTO | null; accounts: ReceivingAcct[] }> {
  const [sale, accounts] = await Promise.all([
    prisma.fieldSale.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            businessName: true,
            phone: true,
            location: true,
            region: true,
            creditSuspended: true,
          },
        },
        rep: { select: { name: true, region: true } },
        items: { include: { product: { select: { name: true } } } },
        payments: {
          where: { financeStatus: "APPROVED" },
          orderBy: { createdAt: "asc" },
          include: {
            recordedBy: { select: { name: true } },
            paymentAccount: { select: { name: true } },
          },
        },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, accountName: true, accountNumber: true },
    }),
  ]);

  if (!sale || sale.voided) return { sale: null, accounts };

  return {
    accounts,
    sale: {
      id: sale.id,
      code: sale.code,
      type: sale.type,
      total: sale.total,
      amountPaid: sale.amountPaid,
      creditStatus: sale.creditStatus,
      dueDate: sale.dueDate ? sale.dueDate.toISOString() : null,
      createdAt: sale.createdAt.toISOString(),
      note: sale.note,
      customerId: sale.customer?.id ?? null,
      customerName: sale.customer?.name ?? sale.customerName ?? "Customer",
      customerBusiness: sale.customer?.businessName ?? null,
      customerPhone: sale.customer?.phone ?? null,
      customerLocation:
        [sale.customer?.location, sale.customer?.region].filter(Boolean).join(", ") || null,
      creditSuspended: sale.customer?.creditSuspended ?? false,
      repName: sale.rep.name,
      repRegion: sale.rep.region,
      items: sale.items.map((i) => ({
        name: i.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      payments: sale.payments.map((p) => ({
        amount: p.amount,
        method: p.method,
        account: p.paymentAccount?.name ?? null,
        reference: p.reference,
        note: p.note,
        proofUrl: p.paymentProofUrl,
        recordedBy: p.recordedBy.name,
        createdAt: p.createdAt.toISOString(),
      })),
    },
  };
}

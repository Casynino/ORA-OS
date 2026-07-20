import { requireRole } from "@/lib/rbac";
import { getOfficeSaleData } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { FieldSaleForm } from "@/components/field/sale-form";

export const dynamic = "force-dynamic";

// Finance records a head-office sale to any customer — cash or credit — drawn
// from the warehouse and confirmed on the spot (Finance is the money authority).
export default async function FinanceSellPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  await requireRole("FINANCE");
  const { customer } = await searchParams;
  const { products, customers, accounts } = await getOfficeSaleData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Record a sale"
        description="Cash or credit for any customer — stock is drawn from the warehouse and the sale is confirmed on the spot."
      />
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <FieldSaleForm
          products={products}
          customers={customers}
          accounts={accounts}
          initialCustomerId={customer}
          warehouse
        />
      </div>
    </div>
  );
}

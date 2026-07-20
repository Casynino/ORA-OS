import { PageHeader } from "@/components/ui/page-header";
import { OrdersControlCenter } from "@/components/admin/orders-control-center";
import { getOrdersOverview } from "@/lib/services/orders-overview";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await getOrdersOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Control Center"
        description="Every order across ORA in one place — partner/agent orders and sales-rep stock requests. Track each from request to completion; open any order for its full timeline and take action."
      />
      <OrdersControlCenter orders={orders} />
    </div>
  );
}

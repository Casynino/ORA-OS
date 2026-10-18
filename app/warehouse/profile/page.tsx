import { requireRole } from "@/lib/rbac";
import { AccountPage } from "@/components/account/account-page";

export const dynamic = "force-dynamic";

export default async function WarehouseProfilePage() {
  const me = await requireRole("WAREHOUSE");
  return <AccountPage userId={me.id} />;
}

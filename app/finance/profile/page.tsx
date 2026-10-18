import { requireRole } from "@/lib/rbac";
import { AccountPage } from "@/components/account/account-page";

export const dynamic = "force-dynamic";

export default async function FinanceProfilePage() {
  const me = await requireRole("FINANCE");
  return <AccountPage userId={me.id} />;
}

import { requireRole } from "@/lib/rbac";
import { AccountPage } from "@/components/account/account-page";

export const dynamic = "force-dynamic";

export default async function DeveloperProfilePage() {
  const me = await requireRole("DEVELOPER");
  return <AccountPage userId={me.id} />;
}

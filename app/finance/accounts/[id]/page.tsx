import { redirect } from "next/navigation";

// Per-account balances and ledgers belong to the CEO — Finance never sees
// account balances. Any direct link here bounces back to the reference list.
export default async function FinanceAccountDetailRedirect() {
  redirect("/finance/accounts");
}

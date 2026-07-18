import { redirect } from "next/navigation";

// Per-account balances and ledgers belong to the CEO — Finance never sees
// account balances and has no accounts module. Any direct link bounces to
// Cash & deposits, where Finance actually works with accounts.
export default async function FinanceAccountDetailRedirect() {
  redirect("/finance/cash");
}

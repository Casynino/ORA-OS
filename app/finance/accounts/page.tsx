import { redirect } from "next/navigation";

// Company bank/mobile-money accounts belong to the CEO (Admin) — Finance has no
// standalone accounts module and never sees balances. Finance picks the
// destination account inside the deposit form and sees which account received a
// payment inside the verification cards. Old links land on Cash & deposits.
export default async function FinanceAccountsRedirect() {
  redirect("/finance/cash");
}

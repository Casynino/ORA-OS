import { redirect } from "next/navigation";
// The separate Expenses + Office Expense Fund modules are now one Operational Fund.
export default function Redirect() {
  redirect("/finance/operational-fund");
}

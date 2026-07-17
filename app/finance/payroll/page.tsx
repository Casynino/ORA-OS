import { redirect } from "next/navigation";

// Payroll is handled directly by the CEO (admin) this phase — the finance
// role does not manage salaries. Old links land on the finance dashboard.
export default function FinancePayrollDisabled() {
  redirect("/finance");
}

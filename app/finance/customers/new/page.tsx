import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getSalesReps } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const dynamic = "force-dynamic";

export default async function FinanceRegisterCustomerPage() {
  await requireRole("FINANCE");
  const reps = await getSalesReps();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/finance/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All customers
      </Link>
      <PageHeader
        title="Register customer"
        description="Onboard a customer into ORA's central database. Capture their full profile, assign a managing sales rep if there is one, and set a credit limit."
      />
      <CustomerForm
        startOpen
        canAssignRep
        canSetCreditLimit
        reps={reps}
        redirectTo="/finance/customers"
      />
    </div>
  );
}

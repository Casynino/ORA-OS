import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getSalesReps } from "@/lib/services/field";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "@/components/customers/customer-form";

export const dynamic = "force-dynamic";

export default async function AdminRegisterCustomerPage() {
  await requireRole("ADMIN");
  const reps = await getSalesReps();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/reps/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All field customers
      </Link>
      <PageHeader
        title="Register customer"
        description="Add a customer to ORA's central database. Assign a managing sales rep (or leave unassigned), set a credit limit, and record any existing outstanding debt as an opening balance."
      />
      <CustomerForm
        startOpen
        canAssignRep
        canSetCreditLimit
        canRecordOpeningBalance
        reps={reps}
        redirectTo="/admin/reps/customers"
      />
    </div>
  );
}

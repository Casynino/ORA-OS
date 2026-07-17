import Link from "next/link";
import { Users } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewCustomerForm } from "@/components/field/field-forms";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepRegisterCustomerPage() {
  await requireRole("SALES_REP");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Register customer"
        description="Add a customer to your book — they're saved to you and ready to sell to."
      >
        <Link href="/rep/customers" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}>
          <Users className="size-4" /> My customers
        </Link>
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <NewCustomerForm startOpen />
      </div>
    </div>
  );
}

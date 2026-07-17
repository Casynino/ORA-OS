import Link from "next/link";
import { CalendarClock, ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ExtensionDecision } from "@/components/admin/extension-decision";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Awaiting decision",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default async function AdminCreditExtensionsPage() {
  await requireRole("ADMIN");

  const requests = await prisma.creditExtensionRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      sale: {
        select: {
          code: true,
          total: true,
          amountPaid: true,
          dueDate: true,
          createdAt: true,
          customer: { select: { id: true, name: true, businessName: true } },
        },
      },
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const decided = requests.filter((r) => r.status !== "PENDING");

  const Card = ({ r }: { r: (typeof requests)[number] }) => {
    const who = r.sale.customer?.businessName ?? r.sale.customer?.name ?? "Unknown customer";
    const balanceNow = Math.max(0, r.sale.total - r.sale.amountPaid);
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {r.sale.customer ? (
                <Link
                  href={`/admin/customers/${r.sale.customer.id}`}
                  className="font-display font-semibold hover:underline"
                >
                  {who}
                </Link>
              ) : (
                <span className="font-display font-semibold">{who}</span>
              )}
              <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sale {r.sale.code} · placed {formatDate(r.sale.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm font-semibold">{formatCurrency(balanceNow)}</p>
            <p className="text-xs text-muted-foreground">outstanding now</p>
          </div>
        </div>

        {/* Original → requested */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
          <CalendarClock className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {r.originalDueDate ? `Original due ${formatDate(r.originalDueDate)}` : "No original due date"}
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">Requested {formatDate(r.requestedDueDate)}</span>
        </div>

        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Reason:</dt>
            <dd>{r.reason}</dd>
          </div>
          {r.financeNotes && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Finance recommendation:</dt>
              <dd>{r.financeNotes}</dd>
            </div>
          )}
          {r.adminNote && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Admin note:</dt>
              <dd>{r.adminNote}</dd>
            </div>
          )}
        </dl>

        <p className="mt-2 text-xs text-muted-foreground">
          Requested by {r.requestedBy.name} · {formatDateTime(r.createdAt)}
          {r.reviewedBy && r.reviewedAt
            ? ` · ${r.status === "APPROVED" ? "approved" : "rejected"} by ${r.reviewedBy.name} · ${formatDateTime(r.reviewedAt)}`
            : ""}
        </p>

        {r.status === "PENDING" && <ExtensionDecision id={r.id} />}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Extension Requests"
        description="Finance raises these when a customer needs more time to pay. Approving moves that credit sale's due date; rejecting leaves it unchanged. Every decision is kept on the customer's record."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">Awaiting your decision</h2>
          {pending.length > 0 && <Badge variant="warning">{pending.length}</Badge>}
        </div>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No extension requests waiting. You&apos;re all caught up.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">History</h2>
          <div className="space-y-3">
            {decided.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

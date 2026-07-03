import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ReportForm } from "@/components/field/field-forms";
import { MapPin } from "lucide-react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepReportsPage() {
  const me = await requireRole("SALES_REP");
  const reports = await prisma.fieldReport.findMany({
    where: { repId: me.id },
    orderBy: { reportDate: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field reports"
        description="File a report at the end of each field day — the ORA team sees it instantly."
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
        <ReportForm />
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">My reports</h2>
        <div className="space-y-2">
          {reports.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No reports filed yet.
            </p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    <MapPin className="size-4 text-primary" /> {r.location}
                  </p>
                  <span className="text-xs text-muted-foreground">{formatDate(r.reportDate)}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Sales {formatCurrency(r.salesAchieved)} · {formatNumber(r.unitsSold)} units ·
                  collected {formatCurrency(r.creditCollected)}
                </p>
                {r.challenges && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Challenges:</span> {r.challenges}
                  </p>
                )}
                {r.marketFeedback && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Feedback:</span> {r.marketFeedback}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

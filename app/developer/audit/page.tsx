import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Activity } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeDevAuditSafe } from "@/lib/developer/audit";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SCOPES = [
  { key: "all", label: "Everything" },
  { key: "developer", label: "Developer actions" },
  { key: "failed", label: "Failures" },
] as const;

type DevMeta = {
  developer?: boolean;
  outcome?: "SUCCESS" | "FAILED";
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

export default async function DeveloperAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const me = await requireRole("DEVELOPER");
  const sp = await searchParams;
  const scope = SCOPES.some((s) => s.key === sp.scope) ? (sp.scope as (typeof SCOPES)[number]["key"]) : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 80);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : "";

  const and: Prisma.ActivityLogWhereInput[] = [];
  if (scope === "developer") and.push({ action: { startsWith: "DEV_" } });
  if (scope === "failed")
    and.push({
      OR: [
        { action: { in: ["DEV_LOGIN_FAILED", "DEV_LOGIN_BLOCKED"] } },
        { meta: { path: ["outcome"], equals: "FAILED" } },
      ],
    });
  if (q)
    and.push({
      OR: [
        { summary: { contains: q, mode: "insensitive" } },
        { actorName: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { entity: { contains: q, mode: "insensitive" } },
      ],
    });
  if (from) and.push({ createdAt: { gte: new Date(`${from}T00:00:00`) } });
  if (to) and.push({ createdAt: { lt: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000) } });
  const where: Prisma.ActivityLogWhereInput = and.length ? { AND: and } : {};

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  // Reading the audit log is itself a recorded action (first page only, so
  // paging through doesn't flood the trail).
  if (page === 1) {
    await writeDevAuditSafe({
      actor: { id: me.id, name: me.name ?? "Developer" },
      action: "DEV_VIEW",
      entity: "AuditLog",
      summary: `Developer viewed the audit log (${scope}${q ? `, “${q}”` : ""}).`,
      outcome: "SUCCESS",
    });
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number, s = scope) => {
    const u = new URLSearchParams();
    if (s !== "all") u.set("scope", s);
    if (q) u.set("q", q);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    if (p > 1) u.set("page", String(p));
    const qs = u.toString();
    return `/developer/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every recorded action across the platform. Developer actions are append-only and can't be edited or deleted — not even from the database."
      />

      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <Link
            key={s.key}
            href={link(1, s.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              scope === s.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <form method="get" className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
        {scope !== "all" && <input type="hidden" name="scope" value={scope} />}
        <Input name="q" defaultValue={q} placeholder="Search who, what or where…" />
        <Input name="from" type="date" defaultValue={from} aria-label="From date" />
        <Input name="to" type="date" defaultValue={to} aria-label="To date" />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Activity} title="Nothing matches" description="Try a wider date range or a different search." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ol className="divide-y divide-border">
              {rows.map((log) => {
                const m = (log.meta ?? {}) as DevMeta;
                const isDev = log.action.startsWith("DEV_");
                const hasDetail = isDev && (m.reason || m.before || m.after || m.ip);
                return (
                  <li key={log.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${
                          m.outcome === "FAILED" ? "bg-destructive" : isDev ? "bg-warning" : "bg-primary"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{log.summary}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {log.actorName ?? "System"} · {formatDateTime(log.createdAt)} ·{" "}
                          <span className="font-mono">{log.action}</span>
                        </p>
                        {hasDetail && (
                          <details className="mt-1.5 text-xs">
                            <summary className="cursor-pointer text-primary">Details</summary>
                            <dl className="mt-1.5 grid gap-1 rounded-lg bg-muted/40 p-2.5">
                              {m.reason && (
                                <div>
                                  <dt className="font-medium">Reason</dt>
                                  <dd className="text-muted-foreground">{m.reason}</dd>
                                </div>
                              )}
                              {m.before != null && (
                                <div>
                                  <dt className="font-medium">Before</dt>
                                  <dd className="break-all font-mono text-muted-foreground">{JSON.stringify(m.before)}</dd>
                                </div>
                              )}
                              {m.after != null && (
                                <div>
                                  <dt className="font-medium">After</dt>
                                  <dd className="break-all font-mono text-muted-foreground">{JSON.stringify(m.after)}</dd>
                                </div>
                              )}
                              {m.ip && (
                                <div>
                                  <dt className="font-medium">From</dt>
                                  <dd className="font-mono text-muted-foreground">{m.ip}</dd>
                                </div>
                              )}
                            </dl>
                          </details>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isDev && <Badge variant="warning">Developer</Badge>}
                        {m.outcome && (
                          <Badge variant={m.outcome === "SUCCESS" ? "success" : "destructive"}>
                            {m.outcome === "SUCCESS" ? "Succeeded" : "Failed"}
                          </Badge>
                        )}
                        <Badge variant="outline">{humanize(log.entity)}</Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {formatNumber(total)} {total === 1 ? "entry" : "entries"} · page {page} of {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={link(page - 1)} className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">
              Newer
            </Link>
          )}
          {page < pages && (
            <Link href={link(page + 1)} className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">
              Older
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

import { Activity, AlertTriangle, Database, KeyRound, ShieldAlert, Users } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { getDiagnostics } from "@/lib/developer/diagnostics";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DeveloperOverviewPage() {
  await requireRole("DEVELOPER");
  const d = await getDiagnostics();

  const missingRequired = d.env.filter((e) => e.required && !e.set);
  const totalUsers = d.usersByRole.reduce((s, r) => s + r._count._all, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System overview"
        description="Health and configuration at a glance. Secrets are never shown — only whether each one is set."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Database"
          value={d.dbOk ? "Online" : "Down"}
          icon={Database}
          accent={d.dbOk ? "success" : "warning"}
          hint={d.dbOk ? `${d.dbMs} ms · ${d.pooled ? "pooled" : "NOT pooled"}` : "Cannot reach the database"}
        />
        <StatCard
          label="Activity (24h)"
          value={formatNumber(d.activity24h)}
          icon={Activity}
          accent="info"
          hint="audit-log entries"
        />
        <StatCard
          label="Failed dev sign-ins (24h)"
          value={formatNumber(d.failedDevLogins24h)}
          icon={ShieldAlert}
          accent={d.failedDevLogins24h > 0 ? "warning" : "success"}
          hint={d.lastDevLogin ? `last sign-in ${formatDateTime(d.lastDevLogin)}` : "no sign-ins yet"}
        />
        <StatCard
          label="Stuck alerts"
          value={formatNumber(d.stuckAlerts)}
          icon={AlertTriangle}
          accent={d.stuckAlerts > 0 ? "warning" : "success"}
          hint="action alerts unresolved > 24h"
        />
      </div>

      {missingRequired.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Missing required configuration: {missingRequired.map((e) => e.name).join(", ")}.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <KeyRound className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Configuration</h2>
            </div>
            <ul className="divide-y divide-border">
              {d.env.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.note}</p>
                  </div>
                  <Badge variant={e.set ? "success" : e.required ? "destructive" : "secondary"}>
                    {e.set ? "set" : "missing"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Accounts · {formatNumber(totalUsers)}</h2>
            </div>
            <ul className="divide-y divide-border">
              {d.usersByRole.length === 0 && (
                <li className="px-5 py-3 text-sm text-muted-foreground">No data.</li>
              )}
              {[...d.usersByRole]
                .sort((a, b) => a.role.localeCompare(b.role) || a.status.localeCompare(b.status))
                .map((r) => (
                  <li key={`${r.role}-${r.status}`} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span>
                      {humanize(r.role)}{" "}
                      <span className="text-xs text-muted-foreground">· {humanize(r.status)}</span>
                    </span>
                    <span className="font-medium tabular-nums">{r._count._all}</span>
                  </li>
                ))}
            </ul>
            <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              Build <span className="font-mono">{d.build.slice(0, 8)}</span> · Node {d.node} · {d.nodeEnv}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

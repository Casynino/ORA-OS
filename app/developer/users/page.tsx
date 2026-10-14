import { Lock } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeDevAuditSafe } from "@/lib/developer/audit";
import { devActivatableIds } from "@/lib/developer/eligibility";
import { canWorkAs } from "@/lib/developer/acting";
import { DevUserActions } from "@/components/developer/user-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDateTime, humanize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "destructive",
};

export default async function DeveloperUsersPage() {
  const me = await requireRole("DEVELOPER");
  const users = await prisma.user.findMany({
    where: { id: { not: me.id } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
  });
  const visible = users.filter((u) => u.role !== "DEVELOPER");
  // Only accounts the Developer console itself suspended can be re-activated here.
  const activatable = await devActivatableIds(
    visible.filter((u) => u.status === "SUSPENDED").map((u) => u.id),
  );

  await writeDevAuditSafe({
    actor: { id: me.id, name: me.name ?? "Developer" },
    action: "DEV_VIEW",
    entity: "User",
    summary: "Developer viewed the user access list.",
    outcome: "SUCCESS",
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="User access"
        description="Work as a team member to see and use their dashboard without their password — everything you do is recorded under your name. You can also suspend or sign out an account (each needs a reason). The business owner's Admin account is protected."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{humanize(u.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[u.status] ?? "secondary"}>{humanize(u.status)}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3.5" /> Protected
                      </span>
                    ) : (
                      <DevUserActions
                        userId={u.id}
                        name={u.name}
                        status={u.status}
                        canActivate={activatable.has(u.id)}
                        canWorkAs={canWorkAs(u, me.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

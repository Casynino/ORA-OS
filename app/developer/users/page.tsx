import { Lock } from "lucide-react";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeDevAuditSafe } from "@/lib/developer/audit";
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
        description="Suspend, re-activate or sign out an account. Each change needs a reason and is recorded under your name. The business owner's Admin account is protected."
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
                      <DevUserActions userId={u.id} name={u.name} status={u.status} />
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

import { Activity } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function AdminActivityPage() {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="A complete, append-only trail of every action across the platform."
      />

      {logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ol className="divide-y divide-border">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-start gap-4 px-5 py-3.5"
                >
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{log.summary}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {log.actorName ?? "System"} · {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {humanize(log.entity)}
                  </Badge>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

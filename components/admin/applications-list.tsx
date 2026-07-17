import Link from "next/link";
import { UserPlus, MapPin, Mail, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

type AppRow = {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  businessType: string | null;
  region: string | null;
  location: string | null;
  createdAt: Date;
};

/** Pending partner applications — shared by the admin and finance queues. */
export function ApplicationsList({
  apps,
  basePath,
}: {
  apps: AppRow[];
  basePath: string;
}) {
  if (apps.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No pending applications"
        description="New partner applications from the website appear here."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {apps.map((a) => (
        <Link
          key={a.id}
          href={`${basePath}/${a.id}`}
          className="flex items-center justify-between gap-4 border-b border-border/70 p-4 transition-colors last:border-0 hover:bg-muted/40"
        >
          <div className="flex items-center gap-3">
            <Avatar name={a.name} className="size-11" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{a.name}</p>
                {a.businessType && <Badge variant="accent">{a.businessType}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{a.organization ?? "Partner"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="size-3" />
                  {a.email}
                </span>
                {(a.region || a.location) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {a.region ?? a.location}
                  </span>
                )}
                <span>· applied {timeAgo(a.createdAt)}</span>
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
            Review
            <ChevronRight className="size-4" />
          </span>
        </Link>
      ))}
    </div>
  );
}

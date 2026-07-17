import {
  UserPlus,
  Banknote,
  CreditCard,
  HandCoins,
  Undo2,
  ShieldCheck,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { TimelineEntry } from "@/lib/services/customer-profile";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const KIND: Record<
  TimelineEntry["kind"],
  { icon: LucideIcon; tint: string }
> = {
  registered: { icon: UserPlus, tint: "bg-primary/10 text-primary" },
  cash: { icon: Banknote, tint: "bg-success/10 text-success" },
  credit: { icon: CreditCard, tint: "bg-accent/10 text-accent" },
  payment: { icon: HandCoins, tint: "bg-success/10 text-success" },
  return: { icon: Undo2, tint: "bg-warning/10 text-warning" },
  "credit-event": { icon: ShieldCheck, tint: "bg-muted text-muted-foreground" },
  note: { icon: StickyNote, tint: "bg-muted text-muted-foreground" },
};

export function CustomerTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {entries.map((e) => {
        const cfg = KIND[e.kind];
        const Icon = cfg.icon;
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[33px] flex size-6 items-center justify-center rounded-full ring-4 ring-background ${cfg.tint}`}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium">{e.label}</p>
              {e.amount != null && (
                <span className="font-display text-sm font-semibold">
                  {formatCurrency(e.amount)}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{formatDateTime(e.date)}</span>
              {e.detail && <span>· {e.detail}</span>}
              {e.status && (
                <Badge variant="secondary" className="text-[10px]">
                  {e.status}
                </Badge>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

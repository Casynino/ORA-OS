import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "primary" | "accent" | "success" | "warning" | "info";

const accentStyles: Record<Accent, string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/12 text-accent",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/12 text-info",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-soft",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              accentStyles[accent],
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

const accents: Record<string, string> = {
  primary: "from-primary/20 to-primary/5 text-primary",
  accent: "from-accent/20 to-accent/5 text-accent",
  success: "from-success/20 to-success/5 text-success",
  warning: "from-warning/25 to-warning/5 text-warning",
  info: "from-info/20 to-info/5 text-info",
};

export function KpiCard({
  label,
  value,
  prefix,
  suffix,
  icon: Icon,
  accent = "primary",
  hint,
  trend,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  accent?: string;
  hint?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-2xl p-5">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br opacity-70 blur-2xl",
          accents[accent],
        )}
      />
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br",
            accents[accent],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="relative mt-3 font-display text-3xl font-bold tracking-tight">
        <CountUp value={value} prefix={prefix} suffix={suffix} />
      </div>
      {(trend || hint) && (
        <div className="relative mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trend.up ? "text-success" : "text-destructive",
              )}
            >
              {trend.up ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {trend.value}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}

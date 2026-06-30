import { Package, ClipboardList, HeartHandshake, Users } from "lucide-react";

const kpis = [
  { label: "Warehouse", value: "8,923", accent: "text-primary", icon: Package },
  { label: "Open requests", value: "12", accent: "text-warning", icon: ClipboardList },
  { label: "Donations", value: "TSh 24M", accent: "text-accent", icon: HeartHandshake },
  { label: "Partners", value: "45", accent: "text-info", icon: Users },
];

const bars = [38, 52, 44, 66, 58, 78, 70, 88, 82, 96, 90, 100];

const activity = [
  { dot: "bg-success", text: "Request REQ-1042 approved" },
  { dot: "bg-accent", text: "Donation TSh 50,000 received" },
  { dot: "bg-primary", text: "Stock dispatched · Mwanza" },
];

/** Stylised, on-brand preview of the Ora control dashboard — pure markup. */
export function OraAppPreview() {
  return (
    <div className="glass-card rounded-[1.4rem] p-2.5 sm:p-3">
      {/* window chrome */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          Ora Control · Admin
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          Live
        </span>
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/70 p-3 sm:p-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-border/60 bg-white/80 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {k.label}
                </span>
                <k.icon className={`size-3.5 ${k.accent}`} />
              </div>
              <div className="mt-1.5 font-display text-lg font-semibold tracking-tight">
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* chart + activity */}
        <div className="mt-3 grid gap-2.5 grid-cols-1 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-border/60 bg-white/80 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Stock movement</span>
              <span className="text-[11px] text-success">+18.4%</span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-primary/70 to-accent/70"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-white/80 p-3">
            <span className="text-xs font-medium">Activity</span>
            <div className="mt-3 space-y-2.5">
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-1 size-1.5 rounded-full ${a.dot}`} />
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {a.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Send, Download, Settings2, Clock } from "lucide-react";
import { generateReportNow, updateReportSettings, sendTestWhatsApp } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { formatDate, timeAgo } from "@/lib/utils";

type Settings = {
  dailyEnabled: boolean; dailyHourEat: number; monthlyEnabled: boolean;
  creditReminderEnabled: boolean; fundRequestAlerts: boolean; repReportAlerts: boolean;
};
type ReportRow = { id: string; type: "DAILY" | "MONTHLY"; title: string; periodStart: string; whatsappSent: boolean; hasPdf: boolean };

const DEFAULTS: Settings = { dailyEnabled: true, dailyHourEat: 19, monthlyEnabled: true, creditReminderEnabled: true, fundRequestAlerts: true, repReportAlerts: true };

export function ReportsManager({ settings, reports }: { settings: Settings | null; reports: ReportRow[] }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(settings ?? DEFAULTS);
  const [tab, setTab] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    startBusy(async () => {
      const res = await fn();
      if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });

  function save() {
    startSave(async () => {
      const res = await updateReportSettings(s);
      if (res.ok) { toast({ variant: "success", title: res.message }); router.refresh(); }
      else toast({ variant: "error", title: res.error });
    });
  }

  const Toggle = ({ label, hint, k }: { label: string; hint: string; k: keyof Settings }) => (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" checked={s[k] as boolean} onChange={(e) => setS({ ...s, [k]: e.target.checked })} className="mt-1 size-4 shrink-0 accent-primary" />
    </label>
  );

  const shown = reports.filter((r) => r.type === tab);

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" disabled={busy} onClick={() => run(() => generateReportNow("DAILY", true))}>
          <FileText className="mr-1.5 size-4" /> Generate & send daily
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => generateReportNow("MONTHLY", true))}>
          <FileText className="mr-1.5 size-4" /> Generate & send monthly
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" disabled={busy} onClick={() => run(() => sendTestWhatsApp())}>
          <Send className="mr-1.5 size-4" /> Send test WhatsApp
        </Button>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Settings2 className="size-4" /> Notification settings
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Toggle label="Daily executive report" hint="PDF + WhatsApp summary each evening" k="dailyEnabled" />
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
            <span className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4 text-muted-foreground" /> Daily send time (EAT)</span>
            <Input type="number" min={0} max={23} value={s.dailyHourEat} onChange={(e) => setS({ ...s, dailyHourEat: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} className="h-8 w-20 text-center" />
          </label>
          <Toggle label="Monthly executive report" hint="Detailed report on the last day of each month" k="monthlyEnabled" />
          <Toggle label="Credit collection reminder" hint="Morning nudge on due/overdue accounts" k="creditReminderEnabled" />
          <Toggle label="Fund request alerts" hint="WhatsApp when Finance requests operational funds" k="fundRequestAlerts" />
          <Toggle label="Field report alerts" hint="WhatsApp when a rep submits their daily report" k="repReportAlerts" />
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" className="rounded-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>

      {/* Archive */}
      <div>
        <div className="mb-3 flex items-center gap-1.5">
          {(["DAILY", "MONTHLY"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${tab === t ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}>
              {t === "DAILY" ? "Daily reports" : "Monthly reports"} ({reports.filter((r) => r.type === t).length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No {tab.toLowerCase()} reports yet.</p>
        ) : (
          <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/50">
            {shown.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(new Date(r.periodStart))} · {timeAgo(new Date(r.periodStart))}
                    {r.whatsappSent && <> · <Badge variant="success" className="text-[10px]">WhatsApp sent</Badge></>}
                  </p>
                </div>
                {r.hasPdf ? (
                  <a href={`/r/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40">
                    <Download className="size-3.5" /> View PDF
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">No PDF</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

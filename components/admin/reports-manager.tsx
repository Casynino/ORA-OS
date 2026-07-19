"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Send, Download, Share2, Search, Settings2, Clock, Zap, ExternalLink, Calendar,
} from "lucide-react";
import { generateReportNow, updateReportSettings, sendTestWhatsApp } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { toast } from "@/components/ui/use-toast";
import { formatDate, timeAgo } from "@/lib/utils";

type Settings = {
  dailyEnabled: boolean; dailyHourEat: number; monthlyEnabled: boolean;
  creditReminderEnabled: boolean; fundRequestAlerts: boolean; repReportAlerts: boolean; paymentConfirmAlerts: boolean;
};
type ReportRow = { id: string; type: "DAILY" | "MONTHLY"; title: string; periodStart: string; createdAt: string; whatsappSent: boolean };

const DEFAULTS: Settings = { dailyEnabled: true, dailyHourEat: 19, monthlyEnabled: true, creditReminderEnabled: true, fundRequestAlerts: true, repReportAlerts: true, paymentConfirmAlerts: true };

export function ReportsManager({ settings, reports }: { settings: Settings | null; reports: ReportRow[] }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(settings ?? DEFAULTS);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [showSettings, setShowSettings] = useState(false);

  // ── Report Center filters ──
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "DAILY" | "MONTHLY">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
        if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
        const d = new Date(r.periodStart);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(`${to}T23:59:59`)) return false;
        return true;
      }),
    [reports, q, typeFilter, from, to],
  );

  const latestDaily = reports.find((r) => r.type === "DAILY");
  const latestMonthly = reports.find((r) => r.type === "MONTHLY");
  const lastGenerated = reports[0];

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

  function share(id: string) {
    const url = `${window.location.origin}/r/${id}`;
    navigator.clipboard?.writeText(url).then(
      () => toast({ variant: "success", title: "Report link copied to clipboard." }),
      () => toast({ variant: "error", title: "Couldn't copy — link: " + url }),
    );
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

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Latest daily report" value={latestDaily ? formatDate(new Date(latestDaily.periodStart)) : "—"} hint={latestDaily ? timeAgo(new Date(latestDaily.createdAt)) : "none yet"} icon={FileText} accent="primary" />
        <StatCard label="This month's report" value={latestMonthly ? formatDate(new Date(latestMonthly.periodStart)) : "—"} hint={latestMonthly ? timeAgo(new Date(latestMonthly.createdAt)) : "generated month-end"} icon={Calendar} accent="accent" />
        <StatCard label="Total reports" value={reports.length} hint="in the archive" icon={FileText} accent="info" />
        <StatCard label="Last generated" value={lastGenerated ? timeAgo(new Date(lastGenerated.createdAt)) : "—"} hint={lastGenerated ? lastGenerated.type.toLowerCase() : "—"} icon={Clock} accent="success" />
      </div>

      {/* Automation status */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
        <Zap className="size-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">
          Reports generate and WhatsApp automatically —{" "}
          <span className="font-medium text-foreground">{s.dailyEnabled ? `daily at ${s.dailyHourEat}:00 EAT` : "daily off"}</span>
          {" "}and{" "}
          <span className="font-medium text-foreground">{s.monthlyEnabled ? "on the last day of each month" : "monthly off"}</span>. No button needed.
        </span>
        <button onClick={() => setShowSettings((v) => !v)} className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <Settings2 className="size-3.5" /> {showSettings ? "Hide settings" : "Settings & manual run"}
        </button>
      </div>

      {/* Settings (collapsed by default — automation is the default flow) */}
      {showSettings && (
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notification settings</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Toggle label="Daily executive report" hint="PDF + WhatsApp summary each evening" k="dailyEnabled" />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-3">
              <span className="flex items-center gap-2 text-sm font-medium"><Clock className="size-4 text-muted-foreground" /> Daily send time (EAT)</span>
              <Input type="number" min={0} max={23} value={s.dailyHourEat} onChange={(e) => setS({ ...s, dailyHourEat: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} className="h-8 w-20 text-center" />
            </label>
            <Toggle label="Monthly executive report" hint="Detailed report on the last day of each month" k="monthlyEnabled" />
            <Toggle label="Credit collection reminder" hint="Morning nudge listing due/overdue customers" k="creditReminderEnabled" />
            <Toggle label="Fund request alerts" hint="Instant WhatsApp when Finance requests funds" k="fundRequestAlerts" />
            <Toggle label="Payment confirmation alerts" hint="Instant WhatsApp when Finance verifies a payment" k="paymentConfirmAlerts" />
            <Toggle label="Field report alerts" hint="Instant WhatsApp when a rep submits their report" k="repReportAlerts" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
            <Button size="sm" className="rounded-full" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</Button>
            <span className="mx-1 text-xs text-muted-foreground">Manual run (testing):</span>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => generateReportNow("DAILY", true))}>Run daily now</Button>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => generateReportNow("MONTHLY", true))}>Run monthly now</Button>
            <Button size="sm" variant="ghost" className="rounded-full" disabled={busy} onClick={() => run(() => sendTestWhatsApp())}><Send className="mr-1.5 size-4" /> Test WhatsApp</Button>
          </div>
        </div>
      )}

      {/* Report Center */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" className="h-9 pl-9" />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/60 p-0.5">
            {(["ALL", "DAILY", "MONTHLY"] as const).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${typeFilter === t ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {t === "ALL" ? "All" : t === "DAILY" ? "Daily" : "Monthly"}
              </button>
            ))}
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[9.5rem]" title="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[9.5rem]" title="To date" />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {reports.length === 0 ? "No reports yet — they'll appear here automatically on schedule." : "No reports match your filters."}
          </p>
        ) : (
          <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card/50">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 truncate text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{r.type === "DAILY" ? "Daily" : "Monthly"}</Badge>
                    {formatDate(new Date(r.periodStart))} · {timeAgo(new Date(r.createdAt))}
                    {r.whatsappSent && <Badge variant="success" className="text-[10px]">WhatsApp sent</Badge>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a href={`/r/${r.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40" title="Open PDF"><ExternalLink className="size-3.5" /> View</a>
                  <a href={`/r/${r.id}?dl=1`} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" title="Download PDF"><Download className="size-3.5" /></a>
                  <button onClick={() => share(r.id)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" title="Copy share link"><Share2 className="size-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

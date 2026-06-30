"use client";

import { useState, useEffect } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
} from "date-fns";
import { CalendarHeart, Droplets, Sparkles, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";

type Log = {
  id: string;
  lastPeriodDate: string;
  cycleLength: number;
  periodLength: number;
  notes?: string;
};

const STORAGE_KEY = "ora-cycle-logs";

const TIPS = [
  "Change pads every 4–6 hours to stay fresh and prevent irritation.",
  "Drink plenty of water and eat iron-rich foods during your period.",
  "Gentle exercise and warmth can ease cramps.",
  "Track your cycle each month — predictions get more accurate over time.",
];

export function PeriodTracker() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [lastPeriodDate, setLastPeriodDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [cycleLength, setCycleLength] = useState("28");
  const [periodLength, setPeriodLength] = useState("5");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLogs(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Log[]) => {
    setLogs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const latest = logs[0];
  let prediction: {
    next: Date;
    daysUntil: number;
    fertileStart: Date;
    fertileEnd: Date;
  } | null = null;

  if (latest) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = addDays(new Date(latest.lastPeriodDate), latest.cycleLength);
    while (isBefore(next, today)) next = addDays(next, latest.cycleLength);
    const ovulation = addDays(next, -14);
    prediction = {
      next,
      daysUntil: differenceInCalendarDays(next, today),
      fertileStart: addDays(ovulation, -5),
      fertileEnd: addDays(ovulation, 1),
    };
  }

  function save() {
    const date = new Date(lastPeriodDate);
    if (Number.isNaN(date.getTime())) {
      toast({ variant: "error", title: "Choose a valid date." });
      return;
    }
    if (date.getTime() > Date.now()) {
      toast({ variant: "error", title: "Date can't be in the future." });
      return;
    }
    const log: Log = {
      id: Math.random().toString(36).slice(2),
      lastPeriodDate,
      cycleLength: Number(cycleLength) || 28,
      periodLength: Number(periodLength) || 5,
      notes: notes || undefined,
    };
    persist([log, ...logs].slice(0, 12));
    setNotes("");
    toast({ variant: "success", title: "Cycle saved — prediction updated." });
  }

  function remove(id: string) {
    persist(logs.filter((l) => l.id !== id));
  }

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card className="lg:sticky lg:top-24 lg:self-start">
        <CardHeader>
          <CardTitle>Log your cycle</CardTitle>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Private — saved only on this device, no account needed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>First day of your last period</Label>
            <Input
              type="date"
              value={lastPeriodDate}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setLastPeriodDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cycle length (days)</Label>
              <Input
                type="number"
                min={15}
                max={60}
                value={cycleLength}
                onChange={(e) => setCycleLength(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Period length (days)</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={periodLength}
                onChange={(e) => setPeriodLength(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Symptoms, mood…"
              className="mt-1.5"
            />
          </div>
          <Button className="w-full" onClick={save}>
            <CalendarHeart className="size-4" />
            Save &amp; predict
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {prediction ? (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-accent to-primary p-6 text-white">
              <p className="text-sm text-white/80">Next period expected</p>
              <p className="mt-1 font-display text-3xl font-bold">
                {format(prediction.next, "EEEE, d MMM")}
              </p>
              <Badge className="mt-3 border-transparent bg-white/20 text-white">
                {prediction.daysUntil === 0
                  ? "Expected today"
                  : `in ${prediction.daysUntil} day${prediction.daysUntil === 1 ? "" : "s"}`}
              </Badge>
            </div>
            <CardContent className="grid grid-cols-2 gap-4 p-6">
              <div className="rounded-xl border border-border p-4">
                <Droplets className="size-5 text-accent" />
                <p className="mt-2 text-sm font-medium">Fertile window</p>
                <p className="text-xs text-muted-foreground">
                  {format(prediction.fertileStart, "d MMM")} –{" "}
                  {format(prediction.fertileEnd, "d MMM")}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <Sparkles className="size-5 text-primary" />
                <p className="mt-2 text-sm font-medium">Cycle length</p>
                <p className="text-xs text-muted-foreground">
                  {latest.cycleLength} days
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={CalendarHeart}
            title="No prediction yet"
            description="Log your last period to see your next expected date and fertile window."
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Health tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {TIPS.map((t) => (
              <div key={t} className="flex gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-muted-foreground">{t}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span>
                    {format(new Date(l.lastPeriodDate), "d MMM yyyy")} ·{" "}
                    {l.cycleLength}d cycle
                  </span>
                  <button
                    onClick={() => remove(l.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

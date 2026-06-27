import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PeriodTracker } from "@/components/dashboard/period-tracker";

export const metadata: Metadata = {
  title: "Period Tracker",
  description:
    "A free, private period tracker — next-period prediction, fertile window and health tips. No account needed.",
};

export default function TrackerPage() {
  return (
    <div className="container py-14">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="accent" className="mx-auto">
          Free &amp; private
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
          Period Tracker
        </h1>
        <p className="mt-3 text-muted-foreground">
          Track your cycle, predict your next period and get health tips. Your
          data stays on your device — no account required.
        </p>
      </div>
      <div className="mt-10">
        <PeriodTracker />
      </div>
    </div>
  );
}

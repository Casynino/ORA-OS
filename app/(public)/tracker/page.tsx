import type { Metadata } from "next";
import { PeriodTracker } from "@/components/dashboard/period-tracker";

export const metadata: Metadata = {
  title: "Period Tracker",
  description:
    "A free, private period tracker — next-period prediction, fertile window and health tips. No account needed.",
};

export default function TrackerPage() {
  return (
    <div className="container pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="max-w-2xl">
        <p className="ora-rise text-sm font-medium text-primary">Free &amp; private</p>
        <h1 className="ora-rise ora-rise-1 mt-3 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
          Period tracker
        </h1>
        <p className="ora-rise ora-rise-2 mt-6 text-[17px] leading-relaxed text-muted-foreground">
          Track your cycle, predict your next period and get health tips. Your data stays on your device — no account
          required.
        </p>
      </div>
      <div className="ora-rise ora-rise-3 mt-12">
        <PeriodTracker />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ArrowDown, Lock } from "lucide-react";
import { PeriodTracker } from "@/components/dashboard/period-tracker";
import { PageHero, SectionHead, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere } from "@/components/site/motion";
import { WordRun } from "@/components/site/pages/products-contact-tracker/shared";

export const metadata: Metadata = {
  title: "Period Tracker",
  description:
    "A free, private period tracker — next-period prediction, fertile window and health tips. No account needed.",
};

/*
 * The tracker as a chapter of the cinematic site (2026-11-09): the opening with an ORA campaign photo in the arch, a
 * band of what it does, then the tracker itself on ORA's night light. The tracker is the shared component; only the
 * page around it changed.
 */
export default function TrackerPage() {
  return (
    <>
      <PageHero
        label="Free & private"
        title="Period tracker"
        accent={["tracker"]}
        aside="No account needed"
        intro="Track your cycle, predict your next period and get health tips. Your data stays on your device — no account required."
        actions={
          <a href="#tracker" className={btnPrimary}>
            Start tracking
            <ArrowDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </a>
        }
        image="/ora/campaign/siku.jpg"
        imageAlt="An ORA campaign photo of a young woman holding ORA packs"
      />

      <WordRun words={["Next-period prediction", "Fertile window", "Health tips", "Stays on your device", "No account needed"]} />

      <section id="tracker" className="relative isolate scroll-mt-20 overflow-hidden py-20 sm:py-28">
        <Atmosphere variant="c" grid={false} className="opacity-60" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index="01"
            label="Your cycle"
            aside={
              <span className="inline-flex items-center gap-2">
                <Lock className="size-3" strokeWidth={1.75} aria-hidden="true" />
                Stays on your device
              </span>
            }
            title="Track your cycle"
            accent={["cycle"]}
            note="Log the first day of your last period to see your next expected date and fertile window."
          />
          <div className="ora-rise ora-rise-3 mt-14">
            <PeriodTracker />
          </div>
        </div>
      </section>
    </>
  );
}

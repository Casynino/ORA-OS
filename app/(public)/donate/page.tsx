import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Heart,
  Coins,
  Droplets,
  Users,
  Smartphone,
  Send,
  PackageCheck,
  ChevronDown,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getPublicImpactStats } from "@/lib/stats";
import { getDonationFeed } from "@/lib/services/donation-feed";
import { DonationForm } from "@/components/public/donation-form";
import { LiveDonationFeed } from "@/components/public/live-donation-feed";
import { AuroraBackground } from "@/components/public/aurora-background";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Power menstrual dignity across Tanzania. Give securely by mobile money — no account needed, funds go straight to ORA.",
};

export const dynamic = "force-dynamic";

const faqs = [
  {
    q: "Is my payment secure?",
    a: "Yes. Payments are collected by NTZS mobile money and settle straight to ORA's treasury. You approve with your own PIN on your phone — we never see it.",
  },
  {
    q: "How does it work?",
    a: "Pick a pack amount, enter your mobile number, and approve the prompt that pops up on your phone. The whole thing takes a few seconds.",
  },
  {
    q: "Do I need an account?",
    a: "No. Giving is open to everyone — just your name and mobile number. No sign-up, no app to download.",
  },
  {
    q: "Where does my money go?",
    a: "Every shilling funds ORA pads delivered to girls in schools and villages across Tanzania. You can watch gifts arrive in the live feed.",
  },
];

export default async function DonatePage() {
  const [packages, stats, feed] = await Promise.all([
    prisma.donationPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getPublicImpactStats(),
    getDonationFeed(),
  ]);

  const heroStats = [
    { icon: Coins, label: "Raised", value: feed.counters.moneyRaised, prefix: "TSh " },
    { icon: Droplets, label: "Pads sponsored", value: feed.counters.padsSponsored },
    { icon: Heart, label: "Girls reached", value: stats.girlsReached },
    { icon: Users, label: "Donors", value: feed.counters.donors },
  ];

  const steps = [
    { icon: Heart, title: "Pick an amount", body: "Sponsor packs or give a custom amount." },
    { icon: Smartphone, title: "Approve on your phone", body: "A mobile-money prompt pops up instantly." },
    { icon: PackageCheck, title: "Reach a girl", body: "Your gift becomes real pads in real hands." },
  ];

  return (
    <div className="relative">
      <AuroraBackground />

      <div className="container relative py-12 sm:py-16">
        {/* ── Hero ── */}
        <Reveal className="mx-auto max-w-3xl text-center">
          <Badge variant="accent" className="mx-auto gap-1.5">
            <Sparkles className="size-3.5" />
            Secure mobile-money giving
          </Badge>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Keep a girl in <span className="text-gradient">school</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            A single pack of pads can be the difference between a missed week and a
            full term. Give in seconds — straight from your phone.
          </p>

          {/* live impact counters */}
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4">
            {heroStats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur-md"
              >
                <s.icon className="mx-auto size-4 text-primary" />
                <div className="mt-1.5 font-display text-xl font-bold tracking-tight">
                  <CountUp value={s.value} prefix={s.prefix ?? ""} />
                </div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="#give"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full bg-gradient-to-r from-primary to-accent px-8 text-base shadow-glow transition-transform hover:scale-[1.02]",
              )}
            >
              <Heart className="size-5" />
              Donate now
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              No account needed · funds go straight to ORA
            </p>
          </div>
        </Reveal>

        {/* ── Give ── */}
        <div
          id="give"
          className="mx-auto mt-14 grid max-w-5xl scroll-mt-24 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start"
        >
          <Reveal>
            <div className="glass-card rounded-3xl p-5 sm:p-7">
              <h2 className="font-display text-xl font-bold tracking-tight">Make your gift</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                100% goes to ORA pads. It takes about 20 seconds.
              </p>
              <div className="mt-5">
                <DonationForm
                  packages={packages.map((p) => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    type: p.type,
                    amount: p.amount,
                    padsQuantity: p.padsQuantity,
                  }))}
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1} className="space-y-5 lg:sticky lg:top-24">
            <LiveDonationFeed initial={feed} showCounters />

            {/* how it works */}
            <div className="glass-card rounded-3xl p-5 sm:p-6">
              <h3 className="font-display text-base font-semibold">How it works</h3>
              <ol className="mt-4 space-y-4">
                {steps.map((s, i) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="size-4" />
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>

        {/* ── FAQ ── */}
        <div className="mx-auto mt-20 max-w-2xl">
          <Reveal className="text-center">
            <div className="mx-auto flex items-center justify-center gap-2 text-primary">
              <span className="h-px w-7 bg-primary/60" />
              <Send className="size-4" />
              <span className="h-px w-7 bg-primary/60" />
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
              Questions, answered
            </h2>
          </Reveal>
          <div className="mt-7 space-y-2.5">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={i * 0.05}>
                <details className="group rounded-2xl border border-border bg-card/50 px-4 backdrop-blur-md transition-colors open:border-primary/40 open:bg-primary/[0.04]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-sm text-muted-foreground">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Final CTA ── */}
        <Reveal className="mx-auto mt-20 max-w-4xl">
          <div className="glow-hover relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-accent p-8 text-center sm:p-12">
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/20 blur-3xl" />
            <h2 className="relative font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
              TSh 5,000 keeps one girl in school all term.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-white/85">
              Join the donors already powering dignity across Tanzania.
            </p>
            <Link
              href="#give"
              className={cn(
                buttonVariants({ size: "lg" }),
                "relative mt-6 h-12 rounded-full bg-white px-8 text-base text-primary hover:bg-white/90",
              )}
            >
              <Heart className="size-5" />
              Donate now
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

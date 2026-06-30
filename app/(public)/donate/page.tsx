import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ShieldCheck,
  ArrowDown,
  Smartphone,
  PackageCheck,
  Sparkles,
  ChevronDown,
  Quote,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getDonationFeed } from "@/lib/services/donation-feed";
import { DonationForm } from "@/components/public/donation-form";
import { LiveDonationFeed } from "@/components/public/live-donation-feed";
import { AmbientDonations, LiveImpactNumbers } from "@/components/public/donate-ambient";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "When a girl has pads, she stays in school. Give securely by mobile money — funds go straight to ORA, no account needed.",
};

export const dynamic = "force-dynamic";

const faqs = [
  {
    q: "Is my payment secure?",
    a: "Yes. Payments are collected by NTZS mobile money and settle straight to ORA's treasury. You approve with your own PIN — we never see it.",
  },
  {
    q: "How does it work?",
    a: "Pick an amount, enter your mobile number, and approve the prompt on your phone. The whole thing takes a few seconds.",
  },
  {
    q: "Do I need an account?",
    a: "No. Giving is open to everyone — just your name and number. No sign-up, no app to download.",
  },
  {
    q: "Where does my money go?",
    a: "Every shilling funds ORA pads delivered to girls in schools and villages across Tanzania. Watch gifts arrive live above.",
  },
];

export default async function DonatePage() {
  const [packages, feed] = await Promise.all([
    prisma.donationPackage.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getDonationFeed(),
  ]);

  const pkgProps = packages.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    type: p.type,
    amount: p.amount,
    padsQuantity: p.padsQuantity,
  }));

  return (
    <div className="relative overflow-hidden">
      {/* ───────────────── Mission hero ───────────────── */}
      <section className="relative flex min-h-[92svh] items-center overflow-hidden">
        <Image
          src="/ora/event/e40.jpg"
          alt="ORA reaching girls across Tanzania"
          fill
          priority
          sizes="100vw"
          className="animate-ken-burns object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0016] via-[#0d0016]/85 to-[#0d0016]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0016] via-transparent to-[#0d0016]/30" />

        <div className="container relative z-10 pb-24 pt-28">
          <Reveal className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-md">
              <Sparkles className="size-3.5 text-primary" />
              Secure mobile-money giving · no account needed
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">
              When she has pads,
              <br />
              she stays in <span className="text-gradient">school</span>.
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/75 sm:text-lg">
              Every gift becomes real pads in the hands of girls across Tanzania —
              given in seconds, straight from your phone.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
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
              <Link
                href="#impact"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/10",
                )}
              >
                See the impact
                <ArrowDown className="size-4" />
              </Link>
            </div>
          </Reveal>
        </div>

        {/* ambient floating donation pill */}
        <AmbientDonations initial={feed} />

        {/* scroll cue */}
        <Link
          href="#impact"
          aria-label="Scroll to impact"
          className="absolute inset-x-0 bottom-6 z-10 mx-auto flex w-fit animate-float-slow flex-col items-center text-white/50 hover:text-white"
        >
          <ChevronDown className="size-5" />
        </Link>
      </section>

      {/* ───────────────── Impact (airy numbers) ───────────────── */}
      <section id="impact" className="relative scroll-mt-20 py-20 sm:py-28">
        <span className="pointer-events-none absolute left-1/2 top-1/3 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <Reveal className="container text-center">
          <div className="mx-auto flex items-center justify-center gap-2 text-primary">
            <span className="h-px w-8 bg-primary/50" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">
              The movement so far
            </span>
            <span className="h-px w-8 bg-primary/50" />
          </div>
          <LiveImpactNumbers initial={feed} className="mt-10" />
          <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Updating live as gifts arrive
          </p>
        </Reveal>
      </section>

      {/* ───────────────── Live community (social stream) ───────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-20">
        <span className="pointer-events-none absolute -left-20 top-10 -z-10 size-72 rounded-full bg-accent/10 blur-3xl animate-float-slow" />
        <span className="pointer-events-none absolute -right-20 bottom-10 -z-10 size-72 rounded-full bg-primary/10 blur-3xl animate-float-slow-rev" />
        <Reveal className="container mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Happening <span className="text-gradient">right now</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Real people, giving in real time. Add your name to the movement.
          </p>
        </Reveal>
        <div className="container mx-auto mt-8 max-w-lg">
          <LiveDonationFeed initial={feed} bare />
        </div>
      </section>

      {/* ───────────────── Give ───────────────── */}
      <section id="give" className="relative scroll-mt-20 py-16 sm:py-20">
        <Reveal className="container mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Choose your impact
          </h2>
          <p className="mt-3 text-muted-foreground">
            100% goes to ORA pads. It takes about 20 seconds.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="container mx-auto mt-8 max-w-xl">
          <div className="rounded-3xl border border-border/60 bg-card/40 p-5 shadow-soft backdrop-blur-xl sm:p-7">
            <DonationForm packages={pkgProps} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {[
              { icon: ShieldCheck, t: "Secure NTZS payment" },
              { icon: Smartphone, t: "Mobile money" },
              { icon: PackageCheck, t: "100% to pads" },
            ].map((b) => (
              <span key={b.t} className="inline-flex items-center gap-1.5">
                <b.icon className="size-3.5 text-success" />
                {b.t}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ───────────────── Story ───────────────── */}
      <section className="container py-16 sm:py-24">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-soft ring-1 ring-border">
              <Image
                src="/ora/lifestyle-1.jpg"
                alt="A girl supported by ORA"
                fill
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Quote className="size-8 text-primary/40" />
            <p className="mt-4 font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              A pack of pads is small. What it protects — her education, her
              confidence, her future — is <span className="text-gradient">everything</span>.
            </p>
            <p className="mt-5 text-sm text-muted-foreground">
              Across Tanzania, periods keep girls out of class. ORA puts that right —
              one girl, one pack, one term at a time. Your gift is the difference.
            </p>
            <Link
              href="#give"
              className={cn(buttonVariants(), "mt-7 rounded-full")}
            >
              <Heart className="size-4" />
              Be the difference
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── FAQ ───────────────── */}
      <section className="container py-12">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight">
            Questions, answered
          </h2>
          <div className="mt-6 space-y-2.5">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-card/40 px-4 backdrop-blur-md transition-colors open:border-primary/40 open:bg-primary/[0.04]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ───────────────── CTA ───────────────── */}
      <section className="container pb-24 pt-8">
        <Reveal className="mx-auto max-w-4xl">
          <div className="glow-hover relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary/85 to-accent p-10 text-center sm:p-14">
            <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              TSh 5,000 keeps a girl in school all term.
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-white/85">
              Join the donors already powering dignity across Tanzania.
            </p>
            <Link
              href="#give"
              className={cn(
                buttonVariants({ size: "lg" }),
                "relative mt-7 h-12 rounded-full bg-white px-9 text-base text-primary hover:bg-white/90",
              )}
            >
              <Heart className="size-5" />
              Donate now
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

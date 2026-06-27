import Link from "next/link";
import Image from "next/image";
import { HeartHandshake, Users, GraduationCap } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import RotatingEarth from "@/components/ui/wireframe-dotted-globe";
import { getPublicImpactStats } from "@/lib/stats";
import { formatNumber } from "@/lib/utils";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let pads = 6000;
  let communities = 42;
  try {
    const s = await getPublicImpactStats();
    pads = s.padsDistributed;
    communities = s.communities;
  } catch {
    // keep baseline figures if the DB is unavailable
  }

  const chips = [
    { icon: HeartHandshake, text: "Dignity for every girl" },
    { icon: Users, text: "Driven by partners & agents" },
    { icon: GraduationCap, text: "No school days lost" },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Movement panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0014] p-10 text-white lg:flex">
        {/* Aurora + faint rotating globe */}
        <div className="pointer-events-none absolute -left-24 -top-24 size-[26rem] rounded-full bg-primary/30 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 -right-20 size-[32rem] rounded-full bg-accent/30 blur-[130px]" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.05]" />
        <div className="pointer-events-none absolute right-[-22%] top-1/2 -translate-y-1/2 opacity-20">
          <RotatingEarth
            width={560}
            height={560}
            showHint={false}
            className="[mask-image:radial-gradient(circle_at_center,black_55%,transparent_85%)]"
          />
        </div>

        {/* Brand + eyebrow */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="w-fit">
            <Logo mark="light" />
          </Link>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            The ORA Movement · Tanzania
          </span>
        </div>

        {/* Movement copy + real photo collage */}
        <div className="relative z-10 space-y-8">
          <div className="max-w-md space-y-4">
            <h2 className="font-display text-4xl font-bold leading-[1.1]">
              Put a pad in{" "}
              <span className="text-gradient">every girl&apos;s hand.</span>
            </h2>
            <p className="text-white/80">
              ORA is a movement, not a shop. Our partners and agents carry pads
              into schools and villages across Tanzania — so no girl ever misses
              a day. Join us and help reach every cycle.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.map((c) => (
                <span
                  key={c.text}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85"
                >
                  <c.icon className="size-3.5 text-primary" />
                  {c.text}
                </span>
              ))}
            </div>
          </div>

          <div className="grid h-[280px] grid-cols-2 grid-rows-2 gap-3">
            <div className="relative row-span-2 overflow-hidden rounded-2xl ring-1 ring-white/15">
              <Image
                src="/ora/lifestyle-1.jpg"
                alt="An ORA ambassador holding pads"
                fill
                sizes="25vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                <span className="text-sm font-semibold">
                  {formatNumber(pads)}+ pads delivered
                </span>
                <p className="text-[11px] text-white/70">
                  {formatNumber(communities)} communities reached
                </p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/15">
              <Image
                src="/ora/gallery/g1.jpg"
                alt="Pads handed to schoolgirls in Tanzania"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/15">
              <Image
                src="/ora/gallery/g7.jpg"
                alt="Girls at an ORA outreach event"
                fill
                sizes="25vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/50">
          © {new Date().getFullYear()} ORA-Pads · Period dignity for all
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

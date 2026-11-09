import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import { ContactCards } from "@/components/public/contact-cards";
import { PageHero, SectionHead, btnGhost, btnPrimary } from "@/components/site/page-hero";
import { Atmosphere, Parallax, Rise, SectionLabel } from "@/components/site/motion";
import { ORA_CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with ORA — customer care, email and our official Instagram and TikTok. We're here to support girls and women across Tanzania.",
};

/*
 * Contact as a chapter of the cinematic site (2026-11-09): the opening with an ORA event day in the arch, a band of
 * what to reach us about, the four ways in as an index of big rows that light up, the hours and the place set huge
 * beside a real ORA school day, and the email address as a giant line over girls laughing. Same contact details.
 */
export default function ContactPage() {
  return (
    <>
      <PageHero
        label="We're here to help"
        title="Get in touch"
        accent={["touch"]}
        aside="Mon – Sat · 8:00 – 18:00 EAT"
        intro={
          <>
            Questions, partnerships or support — reach the ORA team directly. We&apos;d love to hear from you and the
            communities we serve.
          </>
        }
        actions={
          <>
            <a href={ORA_CONTACT.phoneHref} className={btnPrimary}>
              <Phone className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Call customer care
            </a>
            <a href={ORA_CONTACT.emailHref} className={btnGhost}>
              Email us
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={1.5} aria-hidden="true" />
            </a>
          </>
        }
        image="/ora/gallery/g3.jpg"
        imageAlt="An ORA host speaking to students at a school event day"
      />


      {/* 01 — the ways in */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionHead
            index="01"
            label="Ways to reach us"
            aside="Tap to call, write or follow"
            title="Talk to the team"
            accent={["team"]}
            note="Phone and email for questions, partnerships or support — and ORA's official Instagram and TikTok."
          />
          <Rise delay={0.06}>
            <ContactCards className="mt-14" />
          </Rise>
        </div>
      </section>

      {/* 02 — when and where */}
      <section className="relative isolate overflow-hidden py-24 sm:py-32">
        <Atmosphere variant="b" grid={false} className="opacity-70" />
        <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8">
          <SectionLabel index="02" label="When and where" />
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
            <div className="flex min-w-0 flex-col justify-between gap-12">
              <Rise>
                <p className="flex items-center gap-3 s-label">
                  <Clock className="size-4 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                  Customer care hours
                </p>
                <p className="mt-7 font-site-display text-[clamp(2.6rem,6vw,5.6rem)] font-semibold uppercase leading-[0.92] tracking-[-0.04em]">
                  Mon – Sat
                </p>
                <p className="mt-3 font-site-display text-[clamp(1.8rem,3.8vw,3.4rem)] font-medium leading-none tracking-[-0.03em] tabular-nums text-white/85">
                  8:00 – 18:00 <span className="font-site-serif italic text-[rgb(var(--s-pink))]">EAT</span>
                </p>
                <p className="mt-5 text-[15px] leading-relaxed text-white/55 tabular-nums">Monday – Saturday, 8:00 – 18:00 (EAT)</p>
              </Rise>
              <Rise delay={0.08} className="border-t border-white/10 pt-10">
                <p className="flex items-center gap-3 s-label">
                  <MapPin className="size-4 text-[rgb(var(--s-pink))]" strokeWidth={1.5} aria-hidden="true" />
                  Based in Tanzania
                </p>
                <p className="mt-7 font-site-display text-[clamp(2.4rem,5.4vw,5.2rem)] font-semibold uppercase leading-[0.92] tracking-[-0.04em]">
                  Tanzania
                </p>
                <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-white/65">
                  Serving girls and women in communities nationwide.
                </p>
              </Rise>
            </div>
            <Rise delay={0.1} className="s-on-photo relative">
              <Parallax speed={0.1} className="aspect-[4/5] w-full rounded-[2px] border border-white/10 bg-white/5 sm:aspect-[5/4] lg:aspect-auto lg:h-full lg:min-h-[560px]">
                <Image
                  src="/ora/site/wide-GTM00117.jpg"
                  alt="Students gathered outdoors at an ORA school visit"
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  className="object-cover"
                />
              </Parallax>
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-[28px] bg-gradient-to-t from-[rgb(11_6_18/0.75)] to-transparent" />
              <span className="absolute bottom-6 left-6 s-label text-white/85">[ ORA ] — Communities nationwide</span>
            </Rise>
          </div>
        </div>
      </section>

      {/* 03 — the address to write to, huge */}
      <section className="s-on-photo relative isolate overflow-hidden">
        <Parallax speed={0.12} className="absolute inset-0 -z-10">
          <Image src="/ora/site/wide-GTM00015.jpg" alt="" fill sizes="100vw" className="object-cover" />
        </Parallax>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(11_6_18)] via-[rgb(11_6_18/0.74)] to-[rgb(11_6_18/0.55)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_25%_75%,rgb(255_63_168/0.28),transparent_60%)]" />
        <div className="mx-auto flex min-h-[78svh] max-w-[1440px] flex-col justify-end px-5 py-24 sm:px-8 sm:py-32">
          <p className="s-label text-white/75">[ 03 ] — By email</p>
          <Rise>
            <p className="mt-8 font-site-serif text-[clamp(1.6rem,3vw,2.6rem)] italic text-white/85">Prefer to write? Email us at</p>
            <a
              href={ORA_CONTACT.emailHref}
              className="group mt-4 inline-flex max-w-full items-end gap-[0.2em] font-site-display text-[clamp(1.9rem,9vw,7.6rem)] font-semibold leading-[1] tracking-[-0.045em] [overflow-wrap:anywhere]"
            >
              <span className="relative min-w-0">
                {ORA_CONTACT.email}
                <span
                  aria-hidden
                  className="absolute -bottom-[0.06em] left-0 h-[0.06em] w-full origin-left scale-x-0 bg-[rgb(var(--s-pink))] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                />
              </span>
              <ArrowUpRight
                className="mb-[0.08em] size-[0.6em] shrink-0 text-[rgb(var(--s-pink))] transition-transform duration-300 group-hover:rotate-45"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </a>
          </Rise>
        </div>
      </section>
    </>
  );
}

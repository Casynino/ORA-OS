import type { Metadata } from "next";
import { Clock, MapPin } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { ArchPhoto } from "@/components/public/arch-photo";
import { ContactCards } from "@/components/public/contact-cards";
import { ORA_CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with ORA — customer care, email and our official Instagram and TikTok. We're here to support girls and women across Tanzania.",
};

/*
 * Contact (unslop pass, 2026-11-09): the ways to reach ORA as one hairline list, the hours and the place beside it,
 * an ORA event day in the arch on wide screens. No pills, gradient tiles or lifting cards.
 */
export default function ContactPage() {
  return (
    <section className="container grid grid-cols-1 gap-x-16 gap-y-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div>
        <p className="ora-rise text-sm font-medium text-primary">We&apos;re here to help</p>
        <h1 className="ora-rise ora-rise-1 mt-3 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">
          Get in touch
        </h1>
        <p className="ora-rise ora-rise-2 mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
          Questions, partnerships or support — reach the ORA team directly. We&apos;d love to hear from you and the
          communities we serve.
        </p>

        <Reveal delay={0.06}>
          <ContactCards className="mt-12 max-w-xl" />
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-10 grid max-w-xl grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <Clock className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <p className="mt-4 font-medium">Customer care hours</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground tabular-nums">
                Monday – Saturday, 8:00 – 18:00 (EAT)
              </p>
            </div>
            <div>
              <MapPin className="size-5 text-primary" strokeWidth={1.5} aria-hidden="true" />
              <p className="mt-4 font-medium">Based in Tanzania</p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                Serving girls and women in communities nationwide.
              </p>
            </div>
          </div>

          <p className="mt-10 text-[15px] text-muted-foreground">
            Prefer to write? Email us at{" "}
            <a href={ORA_CONTACT.emailHref} className="font-medium text-primary underline-offset-4 hover:underline">
              {ORA_CONTACT.email}
            </a>
            .
          </p>
        </Reveal>
      </div>

      <div className="mx-auto hidden w-full max-w-[440px] text-foreground lg:block lg:pt-4">
        <ArchPhoto
          src="/ora/gallery/g3.jpg"
          alt="An ORA host speaking to students at a school event day"
          sizes="440px"
          position="72% 50%"
          priority
          reveal
          outline
        />
      </div>
    </section>
  );
}

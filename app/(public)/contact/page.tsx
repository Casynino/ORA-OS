import type { Metadata } from "next";
import { MessageCircleHeart, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { ContactCards } from "@/components/public/contact-cards";
import { ORA_CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with ORA — customer care, email and our official Instagram and TikTok. We're here to support girls and women across Tanzania.",
};

export default function ContactPage() {
  return (
    <div className="container py-16 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Badge variant="secondary" className="mb-4 gap-1.5">
            <MessageCircleHeart className="size-3.5" />
            We&apos;re here to help
          </Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Get in <span className="text-gradient">touch</span>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Questions, partnerships or support — reach the ORA team directly.
            We&apos;d love to hear from you and the communities we serve.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.15}>
        <ContactCards className="mx-auto mt-12 max-w-3xl" />
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-5">
            <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Customer care hours</p>
              <p className="text-sm text-muted-foreground">
                Monday – Saturday, 8:00 – 18:00 (EAT)
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-5">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Based in Tanzania</p>
              <p className="text-sm text-muted-foreground">
                Serving girls and women in communities nationwide.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Prefer to write? Email us at{" "}
        <a
          href={ORA_CONTACT.emailHref}
          className="font-medium text-primary hover:underline"
        >
          {ORA_CONTACT.email}
        </a>
        .
      </p>
    </div>
  );
}

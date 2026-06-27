import { Phone, Mail, Instagram } from "lucide-react";
import { TikTokIcon } from "./social-links";
import { ORA_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const methods = [
  {
    label: "Customer Care",
    value: ORA_CONTACT.phoneDisplay,
    href: ORA_CONTACT.phoneHref,
    icon: Phone,
    aria: "Call ORA customer care",
    external: false,
  },
  {
    label: "Email",
    value: ORA_CONTACT.email,
    href: ORA_CONTACT.emailHref,
    icon: Mail,
    aria: "Email ORA",
    external: false,
  },
  {
    label: "Instagram",
    value: "@orapads.tz",
    href: ORA_CONTACT.instagram,
    icon: Instagram,
    aria: "Visit ORA on Instagram",
    external: true,
  },
  {
    label: "TikTok",
    value: "@ora.sanitary.pads",
    href: ORA_CONTACT.tiktok,
    icon: TikTokIcon,
    aria: "Visit ORA on TikTok",
    external: true,
  },
];

/** Premium, tappable contact methods — phone (tel:), email (mailto:), socials. */
export function ContactCards({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {methods.map((m) => {
        const Icon = m.icon;
        return (
          <a
            key={m.label}
            href={m.href}
            aria-label={m.aria}
            title={m.aria}
            {...(m.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary transition-colors group-hover:from-primary group-hover:to-accent group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </span>
              <span className="block truncate font-medium">{m.value}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

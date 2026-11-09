import { Phone, Mail, Instagram, ArrowUpRight } from "lucide-react";
import { TikTokIcon } from "./social-links";
import { ORA_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconClass = "size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary";

const methods = [
  {
    label: "Customer care",
    value: ORA_CONTACT.phoneDisplay,
    href: ORA_CONTACT.phoneHref,
    icon: <Phone className={iconClass} strokeWidth={1.5} aria-hidden="true" />,
    aria: "Call ORA customer care",
    external: false,
  },
  {
    label: "Email",
    value: ORA_CONTACT.email,
    href: ORA_CONTACT.emailHref,
    icon: <Mail className={iconClass} strokeWidth={1.5} aria-hidden="true" />,
    aria: "Email ORA",
    external: false,
  },
  {
    label: "Instagram",
    value: "@orapads.tz",
    href: ORA_CONTACT.instagram,
    icon: <Instagram className={iconClass} strokeWidth={1.5} aria-hidden="true" />,
    aria: "Visit ORA on Instagram",
    external: true,
  },
  {
    label: "TikTok",
    value: "@ora.sanitary.pads",
    href: ORA_CONTACT.tiktok,
    icon: <TikTokIcon className={iconClass} />,
    aria: "Visit ORA on TikTok",
    external: true,
  },
];

/** Tappable contact methods — phone (tel:), email (mailto:), socials — as one hairline list. */
export function ContactCards({ className }: { className?: string }) {
  return (
    <ul className={cn("divide-y divide-border border-y border-border", className)}>
      {methods.map((m) => (
        <li key={m.label}>
          <a
            href={m.href}
            aria-label={m.aria}
            title={m.aria}
            {...(m.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group flex items-center gap-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {m.icon}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-muted-foreground">{m.label}</span>
              <span className="mt-0.5 block truncate text-[17px] font-medium tabular-nums transition-colors duration-150 group-hover:text-primary">
                {m.value}
              </span>
            </span>
            <ArrowUpRight
              className="size-4 shrink-0 text-muted-foreground transition-[transform,color] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

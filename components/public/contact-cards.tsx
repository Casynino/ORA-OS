import { Phone, Mail, Instagram, ArrowUpRight } from "lucide-react";
import { TikTokIcon } from "./social-links";
import { ORA_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconClass = "size-4 shrink-0 text-white/55 transition-colors duration-300 group-hover:text-[rgb(var(--s-pink))]";

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

/**
 * Tappable contact methods — phone (tel:), email (mailto:), socials — as an index of big rows: an outlined number,
 * the way in large, and an arrow that fills pink and turns while a light slides in behind the row.
 */
export function ContactCards({ className }: { className?: string }) {
  return (
    <ul className={cn("border-t border-white/10", className)}>
      {methods.map((m, i) => (
        <li key={m.label}>
          <a
            href={m.href}
            aria-label={m.aria}
            title={m.aria}
            {...(m.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group relative isolate grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 overflow-hidden border-b border-white/10 py-6 outline-none focus-visible:bg-white/[0.04] sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-8 sm:py-9"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 origin-left scale-x-0 bg-white/[0.035] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
            />
            <span aria-hidden="true" className="hidden whitespace-nowrap font-site-display text-[3.4rem] font-semibold leading-none tracking-[-0.05em] s-outline sm:block">
              0{i + 1}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2.5 s-label">
                {m.icon}
                {m.label}
              </span>
              <span className="mt-3 block font-site-display text-[clamp(1.25rem,4.4vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.03em] tabular-nums [overflow-wrap:anywhere] transition-[color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2 group-hover:text-[rgb(var(--s-pink))]">
                {m.value}
              </span>
            </span>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 text-white transition-colors duration-300 group-hover:border-[rgb(var(--s-pink))] group-hover:bg-[rgb(var(--s-pink))] sm:size-14">
              <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} aria-hidden="true" />
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

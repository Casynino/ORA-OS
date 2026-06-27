import { Instagram } from "lucide-react";
import { ORA_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** TikTok glyph — lucide doesn't ship a TikTok brand icon. */
export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M16.5 2h-3.04v13.16a2.34 2.34 0 1 1-2.34-2.34c.18 0 .35.02.52.06V9.78a5.7 5.7 0 0 0-.52-.02 5.45 5.45 0 1 0 5.45 5.45V8.5a7.6 7.6 0 0 0 4.43 1.42V6.85a4.43 4.43 0 0 1-2.6-1.07A4.43 4.43 0 0 1 16.5 2z" />
    </svg>
  );
}

/**
 * Official ORA social icons. Each opens the official profile in a new tab
 * (and the native app on mobile when installed) with an accessible label.
 */
export function SocialLinks({
  className,
  itemClassName,
  iconClassName = "size-4",
}: {
  className?: string;
  itemClassName?: string;
  iconClassName?: string;
}) {
  const base =
    "flex size-9 items-center justify-center rounded-lg transition-colors";
  return (
    <div className={cn("flex gap-3", className)}>
      <a
        href={ORA_CONTACT.instagram}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit ORA on Instagram"
        title="Visit ORA on Instagram"
        className={cn(base, itemClassName)}
      >
        <Instagram className={iconClassName} />
      </a>
      <a
        href={ORA_CONTACT.tiktok}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Visit ORA on TikTok"
        title="Visit ORA on TikTok"
        className={cn(base, itemClassName)}
      >
        <TikTokIcon className={iconClassName} />
      </a>
    </div>
  );
}

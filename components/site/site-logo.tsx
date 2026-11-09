import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The ORA lockup for the public site: the goddess mark beside the ORA wordmark. Both are cut tight from the master
 * logo (public/ora/logo.png) with the lines slightly thickened, because the stacked master logo is unreadable at header
 * size (owner, 2026-11-09: "this might not be visible"). Ink in light mode, white in dark mode; `light` forces white
 * (over a photo). No box or shape around it.
 */
export function SiteLogo({ light, className, priority }: { light?: boolean; className?: string; priority?: boolean }) {
  const tone = light ? "brightness-0 invert" : "dark:brightness-0 dark:invert";
  return (
    <span className={cn("flex items-center gap-2.5 sm:gap-3", className)}>
      <Image src="/ora/logo-mark.png" alt="" width={419} height={651} priority={priority} className={cn("h-10 w-auto transition-[filter] duration-300 sm:h-12", tone)} />
      <Image src="/ora/logo-word.png" alt="ORA" width={364} height={157} priority={priority} className={cn("h-[17px] w-auto transition-[filter] duration-300 sm:h-5", tone)} />
    </span>
  );
}

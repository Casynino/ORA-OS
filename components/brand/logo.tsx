import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  mark = "default",
  priority,
}: {
  className?: string;
  /**
   * `default` — ink line-art that follows the theme (dark ink in light mode,
   * white in dark mode). `light` — always white, for use on dark/coloured
   * panels regardless of theme. `dark` — always ink, for light panels.
   */
  mark?: "default" | "light" | "dark";
  priority?: boolean;
}) {
  return (
    <Image
      src="/ora/logo.png"
      alt="ORA"
      width={150}
      height={250}
      priority={priority}
      className={cn(
        "h-11 w-auto object-contain",
        // The mark is dark ink on a transparent background.
        mark === "default" && "dark:brightness-0 dark:invert",
        mark === "light" && "brightness-0 invert",
        className,
      )}
    />
  );
}

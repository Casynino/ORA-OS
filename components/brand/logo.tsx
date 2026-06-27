import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  mark = "default",
  priority,
}: {
  className?: string;
  mark?: "default" | "light";
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
        mark === "light" && "brightness-0 invert",
        className,
      )}
    />
  );
}

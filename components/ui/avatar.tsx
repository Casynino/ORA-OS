/* eslint-disable @next/next/no-img-element */
import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn(
          "size-9 shrink-0 rounded-full object-cover ring-1 ring-border",
          className,
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
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

"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLYPH, PHONE_TILE, PILL, PhoneTileFace, type ActionPillTone } from "@/components/ui/action-pills";

/**
 * A shortcut that OPENS something (a form in a pop-up) rather than going to a page, drawn exactly like
 * the other shortcuts in the row: an icon over one word on a phone, a pill on a computer.
 */
export function ActionTrigger({
  icon: Icon,
  label,
  short,
  tone = "brand",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  short?: string;
  tone?: ActionPillTone;
  onClick: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onClick} aria-label={label} title={label} className={PHONE_TILE}>
        <PhoneTileFace icon={Icon} label={short ?? label} tone={tone} />
      </button>
      <button type="button" onClick={onClick} className={cn("hidden sm:inline-flex", PILL)}>
        <Icon className={cn("size-4", GLYPH[tone])} strokeWidth={1.75} />
        {label}
      </button>
    </>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { devStopActing } from "@/lib/actions/developer";
import { toast } from "@/components/ui/use-toast";
import { humanize } from "@/lib/utils";

export type ActingState = { as: { name: string; role: string }; developer: string };

/** Is a Developer currently working as a staff member? (null = no) */
export function useActing(): ActingState | null {
  const pathname = usePathname();
  const [state, setState] = useState<ActingState | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/acting", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive) setState(j?.acting ? { as: j.as, developer: j.developer } : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);
  return state;
}

/**
 * "Working as Rehema  [Stop]" — where Stop lives. Hover it to see who the actions
 * are recorded under.
 *  • Desktop (lg+): a small pill in the bottom-right corner that never covers the
 *    page and doesn't move anything.
 *  • Phones / tablets: a slim strip in the normal page flow, at the top of the
 *    content. It takes its own row, so nothing is ever covered or pushed under it
 *    (a floating pill would sit over the page content, the cart bar and the
 *    phone's home bar).
 */
export function ActingBanner({ state }: { state: ActingState }) {
  const [pending, start] = useTransition();

  function stop() {
    start(async () => {
      const res = await devStopActing();
      if (res.ok) window.location.assign("/developer");
      else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div
      className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-accent py-1.5 pl-4 pr-3 text-white print:hidden lg:fixed lg:bottom-4 lg:right-4 lg:z-40 lg:max-w-[calc(100vw-2rem)] lg:justify-start lg:gap-2 lg:rounded-full lg:pr-1.5 lg:shadow-glow lg:ring-1 lg:ring-white/20"
      title={`${humanize(state.as.role)} · everything you do is recorded as ${state.developer} (Developer)`}
      role="status"
    >
      <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">
        Working as {state.as.name}
        <span className="font-normal text-white/80 lg:hidden"> · {humanize(state.as.role)}</span>
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="shrink-0 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-primary transition-colors hover:bg-white/90 disabled:opacity-60 sm:text-sm lg:py-1.5"
      >
        {pending ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}

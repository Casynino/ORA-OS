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
 * A small pill in the corner: "Working as Rehema  [Stop]". It never covers the page
 * (no bar across the top) and it's where Stop lives. Hover it to see who the actions
 * are recorded under.
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
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent py-1.5 pl-4 pr-1.5 text-white shadow-glow ring-1 ring-white/20 print:hidden"
      title={`${humanize(state.as.role)} · everything you do is recorded as ${state.developer} (Developer)`}
      role="status"
    >
      <span className="truncate text-xs font-semibold sm:text-sm">Working as {state.as.name}</span>
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-white/90 disabled:opacity-60 sm:text-sm"
      >
        {pending ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}

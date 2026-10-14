"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { UserRoundCog } from "lucide-react";
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

/** The always-visible reminder that you're the Developer, working as someone. */
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
    <div className="sticky top-0 z-40 flex h-9 items-center justify-between gap-3 bg-warning px-4 text-xs font-medium text-white shadow-sm lg:px-8">
      <span className="flex min-w-0 items-center gap-2">
        <UserRoundCog className="size-4 shrink-0" />
        <span className="truncate">
          Working as {state.as.name} ({humanize(state.as.role)}) — everything you do is recorded as{" "}
          {state.developer} (Developer)
        </span>
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={pending}
        className="shrink-0 rounded-full bg-white/20 px-3 py-1 font-semibold transition-colors hover:bg-white/30 disabled:opacity-60"
      >
        {pending ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}

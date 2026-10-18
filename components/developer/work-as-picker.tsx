"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LogIn, Search } from "lucide-react";
import { devStartActing } from "@/lib/actions/developer";
import { Modal } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { TileBody, tileClass } from "@/components/developer/info";

export type Person = { id: string; name: string; role: string; avatar: string | null };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Owner",
  FINANCE: "Finance",
  WAREHOUSE: "Warehouse",
  SALES_REP: "Sales rep",
  PARTNER: "Partner",
};
const ROLE_ORDER = ["ADMIN", "FINANCE", "WAREHOUSE", "SALES_REP", "PARTNER"];

/** A card that opens a short list of people — tap a name and you are working as them. */
export function WorkAsCard({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  const sorted = [...people].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name),
  );
  const shown = q.trim() ? sorted.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted;

  function pick(p: Person) {
    setBusyId(p.id);
    start(async () => {
      const res = await devStartActing({ userId: p.id });
      if (res.ok && res.data) {
        // Full navigation so the whole app picks up the new session.
        window.location.assign(res.data.redirectTo);
      } else {
        setBusyId(null);
        toast({ variant: "error", title: res.ok ? "Couldn't start." : res.error });
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={tileClass}>
        <TileBody icon={LogIn} title="Work as" text={`${people.length} ${people.length === 1 ? "person" : "people"} to pick from`} />
      </button>

      {open && (
        <Modal open onClose={() => (busyId ? null : setOpen(false))} title="Work as…" description="Tap a person to open their screens.">
          <div className="space-y-3">
            {sorted.length > 7 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="pl-9" autoFocus />
              </div>
            )}
            <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {shown.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No one found.</li>}
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    disabled={busyId !== null}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:opacity-60"
                  >
                    <Avatar name={p.name} src={p.avatar} className="size-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{ROLE_LABEL[p.role] ?? p.role}</span>
                    </span>
                    {busyId === p.id ? (
                      <span className="text-xs text-muted-foreground">Opening…</span>
                    ) : (
                      <ArrowRight className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}

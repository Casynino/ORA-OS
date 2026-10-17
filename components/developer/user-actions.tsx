"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, LogIn, LogOut, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { devSetUserStatus, devForceSignOut, devStartActing } from "@/lib/actions/developer";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

type Kind = "suspend" | "activate" | "signout";

const COPY: Record<Kind, { title: string; blurb: string; cta: string }> = {
  suspend: {
    title: "Suspend account",
    blurb: "They are signed out and can't sign in until you re-activate the account.",
    cta: "Suspend account",
  },
  activate: {
    title: "Re-activate account",
    blurb: "They will be able to sign in again.",
    cta: "Re-activate account",
  },
  signout: {
    title: "Sign out everywhere",
    blurb: "Ends every active session on every device. They can sign straight back in.",
    cta: "Sign them out",
  },
};

/** What "Work as" gives you, per kind of account — shown before you confirm. */
const WORK_AS_SEES: Record<string, string> = {
  ADMIN: "the owner's full dashboard — money, payroll, staff, approvals and reports",
  FINANCE: "the Finance dashboard — payments, deposits, expenses and reports",
  WAREHOUSE: "the Warehouse dashboard — stock, rep requests, orders and transfers",
  SALES_REP: "the Sales Rep dashboard — their stock, customers, sales and collections",
  PARTNER: "the partner portal — orders, credit and invoices",
};

/**
 * Sensitive account actions. Each needs a written reason AND the word CONFIRM —
 * the server re-checks both, and records the action under the Developer's own
 * name with before/after values and the reason.
 */
export function DevUserActions({
  userId,
  name,
  role,
  status,
  canActivate,
  canWorkAs,
  isOwner,
}: {
  userId: string;
  name: string;
  role: string;
  status: string;
  /** True only for accounts the Developer console itself suspended. */
  canActivate: boolean;
  /** An active account you may work as. */
  canWorkAs: boolean;
  /** The owner's Admin account: can be worked as, but never suspended/signed out here. */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind | null>(null);
  const [confirmWork, setConfirmWork] = useState(false);

  function workAs() {
    start(async () => {
      const res = await devStartActing({ userId });
      if (res.ok && res.data) {
        // Full navigation so the whole app picks up the new session.
        window.location.assign(res.data.redirectTo);
      } else {
        toast({ variant: "error", title: res.ok ? "Couldn't start." : res.error });
        setConfirmWork(false);
      }
    });
  }
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  const close = () => {
    setKind(null);
    setReason("");
    setConfirm("");
  };

  function submit() {
    if (!kind) return;
    start(async () => {
      const res =
        kind === "signout"
          ? await devForceSignOut({ userId, reason, confirm })
          : await devSetUserStatus({
              userId,
              status: kind === "suspend" ? "SUSPENDED" : "ACTIVE",
              reason,
              confirm,
            });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Done." });
        close();
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  const ready = reason.trim().length >= 10 && confirm.trim() === "CONFIRM";

  // Approvals and the owner's suspensions/rejections are business decisions —
  // the Developer console can't act on them, so say so instead of offering a button.
  if (status !== "ACTIVE" && !canActivate) {
    return (
      <span className="inline-flex max-w-xs items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        {status === "PENDING"
          ? "Waiting for the owner to approve this account. That decision is hers."
          : "Suspended by the business. Only the owner can re-activate it."}
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {canWorkAs && (
          <Button size="sm" onClick={() => setConfirmWork(true)}>
            <LogIn className="size-3.5" /> Work as
          </Button>
        )}
        {isOwner ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground"
            title="The owner's account can't be suspended or signed out from the Developer console."
          >
            <Lock className="size-3.5" /> Can&apos;t be suspended here
          </span>
        ) : (
          <>
            {status === "ACTIVE" ? (
              <Button size="sm" variant="ghost" onClick={() => setKind("suspend")}>
                <UserX className="size-3.5" /> Suspend
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setKind("activate")}>
                <UserCheck className="size-3.5" /> Activate
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setKind("signout")}>
              <LogOut className="size-3.5" /> Sign out
            </Button>
          </>
        )}
      </div>

      {confirmWork && (
        <Modal
          open
          onClose={() => setConfirmWork(false)}
          title={`Work as ${name}?`}
          description={`You will see ${WORK_AS_SEES[role] ?? "their dashboard"} — exactly as ${name} sees it.`}
        >
          <div className="space-y-4">
            {isOwner && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
                <p className="font-semibold">This is the owner&apos;s account.</p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  You will have the owner&apos;s full powers, including money, payroll and approvals. Be careful — the
                  owner gets a WhatsApp message that you started.
                </p>
              </div>
            )}
            <ul className="space-y-2 rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-sm">
              {[
                <>
                  Everything you do is recorded as{" "}
                  <strong className="text-foreground">&ldquo;you (Developer) as {name}&rdquo;</strong> — never as{" "}
                  {name} alone.
                </>,
                <>The owner is told that you started, and each alert says it was done by the Developer.</>,
                <>
                  You <strong className="text-foreground">cannot</strong> change passwords or login emails, create
                  accounts, or sign people out of all devices while working as them.
                </>,
                <>
                  A bar at the top stays on screen. Press <strong className="text-foreground">Stop</strong> to come
                  back — or it ends by itself after 4 hours.
                </>,
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmWork(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={workAs} disabled={pending}>
                <ShieldCheck className="size-4" />
                {pending ? "Opening…" : `Work as ${name}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {kind && (
        <Modal open onClose={close} title={`${COPY[kind].title} — ${name}`} description={COPY[kind].blurb}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dev-reason">Reason (recorded in the audit log)</Label>
              <Input
                id="dev-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder="e.g. Reported lost phone — securing the account"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
            <div>
              <Label htmlFor="dev-confirm">Type CONFIRM to proceed</Label>
              <Input
                id="dev-confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                className="mt-1.5 tracking-widest"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant={kind === "activate" ? "success" : "destructive"}
                onClick={submit}
                disabled={!ready || pending}
              >
                {pending ? "Working…" : COPY[kind].cta}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

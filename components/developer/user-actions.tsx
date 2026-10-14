"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserCheck, UserX } from "lucide-react";
import { devSetUserStatus, devForceSignOut } from "@/lib/actions/developer";
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

/**
 * Sensitive account actions. Each needs a written reason AND the word CONFIRM —
 * the server re-checks both, and records the action under the Developer's own
 * name with before/after values and the reason.
 */
export function DevUserActions({
  userId,
  name,
  status,
  canActivate,
}: {
  userId: string;
  name: string;
  status: string;
  /** True only for accounts the Developer console itself suspended. */
  canActivate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind | null>(null);
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
      <span className="text-xs text-muted-foreground">
        {status === "PENDING"
          ? "Awaiting owner approval"
          : "Suspended by the business — owner decides"}
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "ACTIVE" ? (
          <Button size="sm" variant="outline" onClick={() => setKind("suspend")}>
            <UserX className="size-3.5" /> Suspend
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setKind("activate")}>
            <UserCheck className="size-3.5" /> Activate
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setKind("signout")}>
          <LogOut className="size-3.5" /> Sign out
        </Button>
      </div>

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

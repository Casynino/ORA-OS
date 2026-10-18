"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Lock, LogIn, LogOut, RefreshCw, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import {
  devSetUserStatus,
  devForceSignOut,
  devStartActing,
  devResetPassword,
  devDeletePreview,
  devDeleteUser,
  type DeletePreview,
} from "@/lib/actions/developer";
import { makePassword } from "@/components/developer/create-account";
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
 * Delete an account. Says plainly what happens first: access and the account go; everything the
 * person recorded stays under their name. Needs a written reason and the word DELETE.
 */
function DeleteAccountModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<DeletePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let alive = true;
    devDeletePreview({ userId })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.data) setInfo(r.data);
        else setLoadError(r.ok ? "Couldn't check this account." : r.error);
      })
      .catch(() => alive && setLoadError("Couldn't check this account."));
    return () => {
      alive = false;
    };
  }, [userId]);

  const ready = !!info && !info.blocked && reason.trim().length >= 10 && confirm.trim() === "DELETE";

  function submit() {
    start(async () => {
      const res = await devDeleteUser({ userId, reason, confirm });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Account deleted." });
        onClose();
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <Modal
      open
      onClose={() => (pending ? null : onClose())}
      title={`Delete ${name}?`}
      description="Removes their access and their account. What they recorded is not touched."
    >
      <div className="space-y-4">
        {loadError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{loadError}</p>
        ) : !info ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Checking what this account is linked to…
          </p>
        ) : info.blocked ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">{info.blocked}</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3.5 py-3 text-sm">
            {info.erase ? (
              <p className="text-muted-foreground">
                <strong className="text-foreground">{name} has no records</strong>, so the account is erased completely.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{name} has {info.records} records</strong>
                  {info.items.length > 0 && <> ({info.items.slice(0, 5).map((i) => `${i.label}: ${i.count}`).join(", ")}
                  {info.items.length > 5 ? " and more" : ""})</>}
                  . <strong className="text-foreground">All of them stay exactly as they are</strong>, still under their name,
                  so money, stock and history keep adding up and still show who did what.
                </p>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> Their login and access are removed. They can never sign in again.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> The account disappears from the people lists, and the email can be used for a new account.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> Their sign-in history and notifications are cleared.
                  </li>
                </ul>
              </>
            )}
            <p className="text-xs text-muted-foreground">This cannot be undone. It is recorded under your name and the owner is told.</p>
          </div>
        )}
        <div>
          <Label htmlFor="dev-del-reason">Reason (recorded in the audit log)</Label>
          <Input
            id="dev-del-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="e.g. Left the company — removing access"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">At least 10 characters.</p>
        </div>
        <div>
          <Label htmlFor="dev-del-confirm">Type DELETE to proceed</Label>
          <Input
            id="dev-del-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="mt-1.5 tracking-widest"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!ready || pending}>
            <Trash2 className="size-4" />
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

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
  onlyAdmin,
}: {
  userId: string;
  name: string;
  role: string;
  status: string;
  /** True only for accounts the Developer console itself suspended. */
  canActivate: boolean;
  /** An active account you may work as. */
  canWorkAs: boolean;
  /** The owner's Admin account (shows an extra warning before you work as them). */
  isOwner: boolean;
  /** The only active Admin: can't be suspended or deleted, or the business would have no owner. */
  onlyAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<Kind | null>(null);
  const [confirmWork, setConfirmWork] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [pwDone, setPwDone] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);

  function openReset() {
    setNewPw(makePassword());
    setShowPw(true);
    setPwDone(false);
    setPwCopied(false);
    setResetOpen(true);
  }
  function submitReset() {
    if (newPw.length < 8) return toast({ variant: "error", title: "The password needs at least 8 characters." });
    start(async () => {
      const res = await devResetPassword({ userId, password: newPw });
      if (res.ok) {
        setPwDone(true);
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

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
      <>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="inline-flex max-w-xs items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {status === "PENDING"
              ? "Waiting for the owner to approve this account. That decision is hers."
              : "Suspended by the business. Only the owner can re-activate it."}
          </span>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
        {deleteOpen && <DeleteAccountModal userId={userId} name={name} onClose={() => setDeleteOpen(false)} />}
      </>
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
        <Button size="sm" variant="ghost" onClick={openReset}>
          <KeyRound className="size-3.5" /> Reset password
        </Button>
        {onlyAdmin ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground"
            title="This is the only active Admin. Create another Admin first, so the business is never left without an owner."
          >
            <Lock className="size-3.5" /> Only active Admin
          </span>
        ) : status === "ACTIVE" ? (
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
        {!onlyAdmin && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> Delete
          </Button>
        )}
      </div>

      {resetOpen && (
        <Modal
          open
          onClose={() => setResetOpen(false)}
          title={pwDone ? "New password set" : `Reset password — ${name}`}
          description={
            pwDone
              ? `${name} was signed out everywhere and can sign in with this password.`
              : "Set a new password for them. They are signed out of every device. The owner is told."
          }
        >
          {pwDone ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <span className="font-mono text-base font-semibold">{newPw}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(newPw);
                      setPwCopied(true);
                      setTimeout(() => setPwCopied(false), 1800);
                    } catch {
                      toast({ variant: "error", title: "Couldn't copy — select it and copy by hand." });
                    }
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Copy password"
                >
                  {pwCopied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">It is shown only here, once. Share it with them privately.</p>
              <Button className="w-full" onClick={() => setResetOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>New password</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="font-mono"
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewPw(makePassword())} aria-label="Make a new password">
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Made for you. You can type your own (8+ characters).</p>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={submitReset} disabled={pending}>
                  {pending ? "Saving…" : "Set new password"}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

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
                  A small pill in the corner shows who you are working as. Press <strong className="text-foreground">Stop</strong> on it to
                  come back — or it ends by itself after 4 hours.
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

      {deleteOpen && <DeleteAccountModal userId={userId} name={name} onClose={() => setDeleteOpen(false)} />}

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

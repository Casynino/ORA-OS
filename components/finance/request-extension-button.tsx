"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import {
  createCreditExtension,
  applyCreditExtensionDirect,
} from "@/lib/actions/credit-extensions";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Extend the payment deadline on a credit sale. Three modes:
 *
 * • Admin — moves the due date directly, always (they're the approver).
 * • Rep / Finance, FIRST extension on this sale — self-service: applies
 *   immediately (no approval) and the boss gets a WhatsApp with the details.
 * • Rep / Finance, SECOND+ extension on this sale — files a request that goes to
 *   the boss for approval.
 *
 * `isAdmin` and `extendedBefore` pick the mode; the server enforces the same
 * rule regardless of what the client shows.
 */
export function RequestExtensionButton({
  saleId,
  saleCode,
  owing,
  currentDueDate,
  hasPendingExtension,
  isAdmin = false,
  extendedBefore = false,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  currentDueDate: string | null; // ISO (yyyy-mm-dd) or null
  hasPendingExtension: boolean;
  /** Admin extends directly instead of filing a request. */
  isAdmin?: boolean;
  /** This sale already has an approved extension — a further one needs approval. */
  extendedBefore?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");
  const [notes, setNotes] = useState("");

  if (hasPendingExtension) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
        <CalendarClock className="size-3.5" />
        {isAdmin ? "Extension awaiting your approval" : "Extension pending admin approval"}
      </span>
    );
  }

  // Direct = applies immediately: admin always, or a rep/finance's FIRST extension.
  // needsApproval = a rep/finance's second+ extension → goes to the boss.
  const direct = isAdmin || !extendedBefore;
  const needsApproval = !isAdmin && extendedBefore;

  function submit() {
    if (reason.trim().length < 3) {
      toast({ variant: "error", title: "Add the reason for the extension." });
      return;
    }
    if (!newDate) {
      toast({ variant: "error", title: "Pick the new payment date." });
      return;
    }
    if (currentDueDate && newDate <= currentDueDate) {
      toast({ variant: "error", title: "The new date must be after the current due date." });
      return;
    }
    start(async () => {
      const res = isAdmin
        ? await applyCreditExtensionDirect({
            saleId,
            reason: reason.trim(),
            newDueDate: newDate,
            adminNote: notes.trim() || undefined,
          })
        : await createCreditExtension({
            saleId,
            reason: reason.trim(),
            requestedDueDate: newDate,
            financeNotes: notes.trim() || undefined,
          });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Done." });
        setOpen(false);
        setReason("");
        setNewDate("");
        setNotes("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        <CalendarClock className="size-3.5" /> {needsApproval ? "Request extension" : "Extend due date"}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`${needsApproval ? "Request credit extension" : "Extend credit due date"} · ${saleCode}`}
          description={`Outstanding ${formatCurrency(owing)}${currentDueDate ? ` · currently due ${formatDate(new Date(currentDueDate))}` : ""}. ${
            isAdmin
              ? "The due date moves as soon as you confirm."
              : needsApproval
                ? "This sale was already extended once, so this goes to the boss for approval."
                : "First extension — it applies immediately and the boss is notified."
          }`}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                {needsApproval ? "Requested new payment date *" : "New payment date *"}
              </Label>
              <Input
                type="date"
                value={newDate}
                min={currentDueDate ?? undefined}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason for the extension *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why does the customer need more time?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {isAdmin ? "Note (optional)" : needsApproval ? "Note to the boss (optional)" : "Note (optional)"}
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={needsApproval ? "Anything for the boss to consider" : "Add a note for the record"}
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending
                ? needsApproval
                  ? "Sending…"
                  : "Extending…"
                : needsApproval
                  ? "Send to boss for approval"
                  : direct && isAdmin
                    ? "Move due date"
                    : "Extend due date"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

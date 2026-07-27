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
 * Extend the payment deadline on a credit sale.
 *
 * • Reps / Finance FILE a request — they never move the due date themselves; it
 *   goes to Admin for approval.
 * • Admin (the approver) moves the due date DIRECTLY — no request/approval round
 *   trip. `isAdmin` switches the button, copy and action accordingly.
 */
export function RequestExtensionButton({
  saleId,
  saleCode,
  owing,
  currentDueDate,
  hasPendingExtension,
  isAdmin = false,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  currentDueDate: string | null; // ISO (yyyy-mm-dd) or null
  hasPendingExtension: boolean;
  /** Admin extends directly instead of filing a request for approval. */
  isAdmin?: boolean;
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
        <CalendarClock className="size-3.5" /> {isAdmin ? "Extend due date" : "Request extension"}
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`${isAdmin ? "Extend credit due date" : "Request credit extension"} · ${saleCode}`}
          description={`Outstanding ${formatCurrency(owing)}${currentDueDate ? ` · currently due ${formatDate(new Date(currentDueDate))}` : ""}. ${
            isAdmin
              ? "The due date moves as soon as you confirm."
              : "Admin approves before the due date moves."
          }`}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                {isAdmin ? "New payment date *" : "Requested new payment date *"}
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
                {isAdmin ? "Note (optional)" : "Finance notes / recommendation (optional)"}
              </Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAdmin ? "Add a note for the record" : "Your recommendation to admin"}
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending
                ? isAdmin
                  ? "Extending…"
                  : "Sending…"
                : isAdmin
                  ? "Move due date"
                  : "Send to admin for approval"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

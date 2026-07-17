"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { createCreditExtension } from "@/lib/actions/credit-extensions";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Finance files a credit-extension request against a credit sale — the customer
 * asked for more time. It captures the reason, the requested new payment date
 * and finance's notes, then goes to Admin for approval. Finance never changes
 * the due date directly; only an approved request moves it.
 */
export function RequestExtensionButton({
  saleId,
  saleCode,
  owing,
  currentDueDate,
  hasPendingExtension,
}: {
  saleId: string;
  saleCode: string;
  owing: number;
  currentDueDate: string | null; // ISO (yyyy-mm-dd) or null
  hasPendingExtension: boolean;
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
        <CalendarClock className="size-3.5" /> Extension pending admin approval
      </span>
    );
  }

  function submit() {
    if (reason.trim().length < 3) {
      toast({ variant: "error", title: "Add the reason for the extension." });
      return;
    }
    if (!newDate) {
      toast({ variant: "error", title: "Pick the requested new payment date." });
      return;
    }
    if (currentDueDate && newDate <= currentDueDate) {
      toast({ variant: "error", title: "The new date must be after the current due date." });
      return;
    }
    start(async () => {
      const res = await createCreditExtension({
        saleId,
        reason: reason.trim(),
        requestedDueDate: newDate,
        financeNotes: notes.trim() || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Extension requested." });
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
        <CalendarClock className="size-3.5" /> Request extension
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Request credit extension · ${saleCode}`}
          description={`Outstanding ${formatCurrency(owing)}${currentDueDate ? ` · currently due ${formatDate(new Date(currentDueDate))}` : ""}. Admin approves before the due date moves.`}
        >
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Requested new payment date *</Label>
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
              <Label className="text-xs text-muted-foreground">Finance notes / recommendation (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Your recommendation to admin"
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send to admin for approval"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

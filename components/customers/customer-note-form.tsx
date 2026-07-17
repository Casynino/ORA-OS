"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addFieldCustomerNote } from "@/lib/actions/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/** Add a dated note to a customer — lands on the activity timeline. */
export function CustomerNoteForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (note.trim().length < 2) {
      toast({ variant: "error", title: "Write a note first." });
      return;
    }
    start(async () => {
      const res = await addFieldCustomerNote(customerId, note);
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setNote("");
        router.refresh();
      } else toast({ variant: "error", title: res.error });
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Add a note
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Follow-up, promise-to-pay, delivery detail…"
        rows={2}
        maxLength={500}
        className="mt-2"
      />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          className="rounded-full"
          disabled={pending || note.trim().length < 2}
          onClick={submit}
        >
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </div>
  );
}

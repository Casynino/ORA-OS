"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  approveCreditExtension,
  rejectCreditExtension,
} from "@/lib/actions/credit-extensions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

/** Admin approve/reject controls for one pending credit-extension request. */
export function ExtensionDecision({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<null | "approve" | "reject">(null);

  function decide(kind: "approve" | "reject") {
    start(async () => {
      const fn = kind === "approve" ? approveCreditExtension : rejectCreditExtension;
      const res = await fn({ id, adminNote: note.trim() || undefined });
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Done." });
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <Label className="text-xs text-muted-foreground">Admin note (optional)</Label>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason for your decision…"
        className="mt-1.5 h-9"
      />
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="success"
          disabled={pending}
          onClick={() => {
            setMode("approve");
            decide("approve");
          }}
        >
          <Check className="size-3.5" />
          {pending && mode === "approve" ? "Approving…" : "Approve extension"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            setMode("reject");
            decide("reject");
          }}
        >
          <X className="size-3.5" />
          {pending && mode === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

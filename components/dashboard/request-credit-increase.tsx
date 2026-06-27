"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { requestCreditIncrease } from "@/lib/actions/users";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";

export function RequestCreditIncrease({ currentLimit }: { currentLimit: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const res = await requestCreditIncrease({
        requestedLimit: amount ? Number(amount) : undefined,
        note: note || undefined,
      });
      if (res.ok) {
        toast({ variant: "success", title: res.message });
        setOpen(false);
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        toast({ variant: "error", title: res.error });
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <TrendingUp className="size-4" />
        Request credit increase
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Request a credit increase"
          description={`Your current limit is ${formatCurrency(currentLimit)}. Tell the ORA team what you'd like and why.`}
        >
          <div className="space-y-4">
            <div>
              <Label>Requested limit (optional)</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 300000"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Growing demand, new outreach, larger orders…"
                className="mt-1.5"
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={pending}>
              {pending ? "Sending…" : "Send request"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              The ORA team reviews every request. Your limit only changes once
              they approve it.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

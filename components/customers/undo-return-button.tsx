"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { undoCustomerReturn } from "@/lib/actions/returns";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/** Rep takes back a customer return they recorded by mistake. */
export function UndoReturnButton({ returnId, code }: { returnId: string; code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function undo() {
    if (!window.confirm(`Undo return ${code}? The pieces leave your stock again and the customer owes that amount again.`)) return;
    start(async () => {
      const res = await undoCustomerReturn(returnId);
      toast(res.ok ? { variant: "success", title: res.message } : { variant: "error", title: res.error });
      router.refresh();
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={undo} disabled={pending}>
      <Undo2 className="size-3.5" /> {pending ? "Undoing…" : "Undo"}
    </Button>
  );
}

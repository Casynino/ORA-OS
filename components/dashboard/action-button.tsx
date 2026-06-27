"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import type { ActionResult } from "@/lib/types";

export function ActionButton({
  action,
  children,
  confirm,
  pendingText,
  onDone,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult>;
  confirm?: string;
  pendingText?: string;
  onDone?: (res: ActionResult) => void;
}) {
  const [pending, start] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const res = await action();
      if (res.ok) {
        toast({ variant: "success", title: res.message ?? "Done." });
      } else {
        toast({ variant: "error", title: res.error });
      }
      onDone?.(res);
    });
  }

  return (
    <Button onClick={run} disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}

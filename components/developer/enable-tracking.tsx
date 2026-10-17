"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { devEnableErrorTracking } from "@/lib/actions/developer";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function EnableTrackingButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await devEnableErrorTracking();
          if (res.ok) {
            toast({ variant: "success", title: res.message ?? "Error tracking is on." });
            router.refresh();
          } else {
            toast({ variant: "error", title: res.error });
          }
        })
      }
    >
      <Activity className="size-4" />
      {pending ? "Turning on…" : "Turn on error tracking"}
    </Button>
  );
}

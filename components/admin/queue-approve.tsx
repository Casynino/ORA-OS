"use client";

import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/dashboard/action-button";
import { approveReturn } from "@/lib/actions/returns";
import { approveAgent } from "@/lib/actions/users";

export function QueueApprove({
  kind,
  id,
}: {
  kind: "return" | "application";
  id: string;
}) {
  const router = useRouter();
  const action =
    kind === "return" ? () => approveReturn(id) : () => approveAgent(id);

  return (
    <ActionButton
      size="sm"
      variant="success"
      action={action}
      onDone={() => router.refresh()}
      pendingText="…"
    >
      Approve
    </ActionButton>
  );
}

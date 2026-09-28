"use client";

import { ProofViewer } from "@/components/ui/proof-viewer";
import type { AttachmentDTO } from "@/lib/attachments";

/**
 * Show all attachments for a record. One file keeps the familiar thumbnail; more
 * than one lists as compact chips (opens each in the lightbox / new tab). Renders
 * nothing (or a dash) when there are none.
 */
export function AttachmentsViewer({
  items,
  label = "View proof",
  emptyDash = false,
  className,
}: {
  items: AttachmentDTO[];
  /** Base label for unnamed files, e.g. "Receipt" → "Receipt 1", "Receipt 2". */
  label?: string;
  /** Show a muted "—" when empty instead of nothing. */
  emptyDash?: boolean;
  className?: string;
}) {
  if (!items || items.length === 0) {
    return emptyDash ? <span className="text-xs text-muted-foreground">—</span> : null;
  }
  const many = items.length > 1;
  return (
    <div className={className ?? "flex flex-col gap-1"}>
      {items.map((a, i) => (
        <ProofViewer
          key={a.id}
          url={a.url}
          name={a.name}
          contentType={a.contentType}
          label={a.name?.trim() || (many ? `${label} ${i + 1}` : label)}
          compact={many}
        />
      ))}
    </div>
  );
}

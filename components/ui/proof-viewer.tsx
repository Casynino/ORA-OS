"use client";

import { useState } from "react";
import { Paperclip, Download } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/**
 * View an uploaded proof image in an in-app lightbox with a Download button.
 * Works whether the URL is a data: URL (browsers block opening those as a top
 * -level tab — hence the modal) or a hosted blob/http URL.
 */
export function ProofViewer({
  url,
  label = "View proof",
  compact = false,
}: {
  url: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  async function download() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = "payment-proof.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
    } catch {
      // Hosted URLs can still be opened directly if the download fetch fails.
      if (!url.startsWith("data:")) window.open(url, "_blank", "noopener");
      else toast({ variant: "error", title: "Couldn't download the image." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        {!compact && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Proof" className="size-10 shrink-0 rounded object-cover" />
        )}
        <Paperclip className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Payment proof">
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Payment proof"
              className="max-h-[65vh] w-full rounded-lg bg-muted/30 object-contain"
            />
            <Button className="w-full" onClick={download}>
              <Download className="size-4" /> Download image
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

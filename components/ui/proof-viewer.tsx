"use client";

import { useState } from "react";
import { Paperclip, Download, ExternalLink, ImageOff } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/**
 * View an uploaded proof image in an in-app lightbox with a Download button.
 * Works whether the URL is a data: URL (browsers block opening those as a top
 * -level tab — hence the modal) or a hosted blob/http URL.
 *
 * If the browser can't render the file inline (e.g. an iPhone HEIC photo, which
 * desktop browsers can't decode) we fall back to an "Open in new tab" + Download
 * path so the proof is never a dead end.
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
  const [failed, setFailed] = useState(false);
  const isData = url.startsWith("data:");

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
      if (!isData) window.open(url, "_blank", "noopener");
      else toast({ variant: "error", title: "Couldn't download the image." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        {!compact && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Proof"
            className="size-10 shrink-0 rounded object-cover"
            onError={(e) => {
              // Hide a broken thumbnail rather than showing the torn-image icon.
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <Paperclip className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Payment proof">
          <div className="space-y-3">
            {!failed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt="Payment proof"
                className="max-h-[65vh] w-full rounded-lg bg-muted/30 object-contain"
                onError={() => setFailed(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                <ImageOff className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">This file can&apos;t be previewed here</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  It looks like an iPhone photo (HEIC), which browsers can&apos;t show inline.
                  {isData
                    ? " Download it to view — your device opens it fine."
                    : " Open it in a new tab or download it to view."}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {failed && !isData && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(url, "_blank", "noopener")}
                >
                  <ExternalLink className="size-4" /> Open in new tab
                </Button>
              )}
              <Button className="w-full" onClick={download}>
                <Download className="size-4" /> Download image
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

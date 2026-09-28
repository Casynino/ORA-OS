"use client";

import { useState } from "react";
import { Paperclip, Download, ExternalLink, ImageOff, FileText } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { isImageAttachment } from "@/lib/attachments";

/**
 * View a single uploaded attachment.
 *
 * Images open in an in-app lightbox with a Download button (works whether the
 * URL is a data: URL — which browsers block opening as a top-level tab — or a
 * hosted blob/http URL). If the browser can't render it inline (e.g. an iPhone
 * HEIC photo) it falls back to "Open in new tab" + Download so the proof is
 * never a dead end.
 *
 * PDFs (and any non-image file) render as a document chip that opens in a new
 * tab (hosted) or downloads (data: URL) — no broken inline <img>.
 */
export function ProofViewer({
  url,
  label = "View proof",
  compact = false,
  name,
  contentType,
}: {
  url: string;
  label?: string;
  compact?: boolean;
  name?: string | null;
  contentType?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const isData = url.startsWith("data:");
  const image = isImageAttachment({ url, contentType });
  const downloadName = name?.trim() || (image ? "payment-proof.jpg" : "document.pdf");

  async function download() {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 5000);
    } catch {
      // Hosted URLs can still be opened directly if the download fetch fails.
      if (!isData) window.open(url, "_blank", "noopener");
      else toast({ variant: "error", title: "Couldn't download the file." });
    }
  }

  // ── Document (PDF / non-image): a chip, no lightbox ──
  if (!image) {
    return (
      <button
        type="button"
        onClick={() => {
          if (isData) download();
          else window.open(url, "_blank", "noopener");
        }}
        className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        {!compact && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
        )}
        <FileText className="size-3.5 shrink-0" />
        <span className="truncate">{name?.trim() || label}</span>
      </button>
    );
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
        <Modal open onClose={() => setOpen(false)} title={name?.trim() || "Payment proof"}>
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

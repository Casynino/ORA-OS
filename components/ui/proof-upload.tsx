"use client";

import { useState } from "react";
import { Loader2, ImagePlus, Paperclip, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

/**
 * Shrink a phone photo before upload: decode, scale to a max edge, re-encode as
 * JPEG. Keeps proof images small (and normalises HEIC/large captures). Falls
 * back to the original file if the browser can't decode it.
 */
async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    // Only use the compressed version if it actually came out smaller.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload a proof image (payment receipt, deposit slip, office-fund receipt) to
 * the shared /api/upload endpoint (Vercel Blob in prod). Controlled: the parent
 * holds the resulting URL string and re-renders a thumbnail + remove button.
 */
export function ProofUpload({
  value,
  onChange,
  label = "Attach proof",
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed, file.name.replace(/\.[^.]+$/, "") + ".jpg");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        onChange(data.url);
        toast({ variant: "success", title: "Proof uploaded." });
      } else {
        toast({ variant: "error", title: data.error ?? "Upload failed." });
      }
    } catch {
      toast({ variant: "error", title: "Upload failed." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Proof" className="size-14 shrink-0 rounded-md object-cover" />
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
        >
          <Paperclip className="mr-1 inline size-3.5" />
          View uploaded proof
        </a>
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
          aria-label="Remove proof"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
      {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      {uploading ? "Uploading…" : label}
      {hint && <span className="text-xs text-muted-foreground/70">· {hint}</span>}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
        disabled={uploading}
      />
    </label>
  );
}

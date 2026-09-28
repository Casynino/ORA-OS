"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, X, FileText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  type AttachmentInput,
  isImageAttachment,
  formatBytes,
} from "@/lib/attachments";

/**
 * Shrink a phone photo before upload: decode, scale to a max edge, re-encode as
 * JPEG. Keeps proof images small (and normalises HEIC/large captures). Falls
 * back to the original file if the browser can't decode it. PDFs pass straight
 * through untouched.
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
    const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    return blob && (blob.size < file.size || heic) ? blob : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload one file to the shared endpoint. Returns the stored attachment or null. */
async function uploadOne(file: File): Promise<AttachmentInput | null> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const compressed = isPdf ? file : await compressImage(file);
  // A still-HEIC output means this browser couldn't convert it — reject rather
  // than store a proof nothing can preview.
  if (!isPdf && /heic|heif/i.test(compressed.type)) {
    toast({
      variant: "error",
      title: "Can't use this iPhone photo (HEIC)",
      description: "Please upload a JPEG or PNG, or retake it in the app.",
    });
    return null;
  }
  const fd = new FormData();
  const outName = isPdf ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
  fd.append("file", compressed, outName);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.url) {
    return {
      url: data.url as string,
      name: (data.name as string) ?? file.name,
      contentType: (data.contentType as string) ?? file.type ?? null,
      size: typeof data.size === "number" ? data.size : file.size,
    };
  }
  toast({ variant: "error", title: data.error ?? `Couldn't upload ${file.name}.` });
  return null;
}

/**
 * Multi-file attachment picker. Users can select several files at once, add more
 * later, preview each, and remove individual ones. Controlled: the parent holds
 * an array of {url,name,contentType,size}. Used everywhere an attachment/proof is
 * captured (payments, deposits, expenses, capital, supporting documents).
 */
export function AttachmentsUpload({
  value,
  onChange,
  label = "Attach files",
  hint = "Photos or PDF — add as many as you need",
  max = 20,
  accept = "image/*,application/pdf",
}: {
  value: AttachmentInput[];
  onChange: (files: AttachmentInput[]) => void;
  label?: string;
  hint?: string;
  max?: number;
  accept?: string;
}) {
  const [uploading, setUploading] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (picked.length === 0) return;

    const room = max - value.length;
    if (room <= 0) {
      toast({ variant: "error", title: `You can attach up to ${max} files here.` });
      return;
    }
    const toUpload = picked.slice(0, room);
    if (picked.length > room) {
      toast({ variant: "error", title: `Only ${room} more file${room === 1 ? "" : "s"} can be added.` });
    }

    setUploading((n) => n + toUpload.length);
    // Upload in parallel; append each as it lands so the user sees progress.
    const results = await Promise.all(
      toUpload.map(async (f) => {
        try {
          return await uploadOne(f);
        } catch {
          toast({ variant: "error", title: `Couldn't upload ${f.name}.` });
          return null;
        } finally {
          setUploading((n) => Math.max(0, n - 1));
        }
      }),
    );
    const added = results.filter((r): r is AttachmentInput => !!r);
    if (added.length > 0) {
      // De-dupe by URL against what's already there.
      const seen = new Set(value.map((v) => v.url));
      const merged = [...value, ...added.filter((a) => !seen.has(a.url))];
      onChange(merged);
      toast({
        variant: "success",
        title: added.length === 1 ? "File attached." : `${added.length} files attached.`,
      });
    }
  }

  function remove(url: string) {
    onChange(value.filter((v) => v.url !== url));
  }

  const full = value.length >= max;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => {
            const image = isImageAttachment(f);
            return (
              <li
                key={f.url}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.url}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded bg-background">
                    <FileText className="size-5 text-muted-foreground" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name || (image ? "Photo" : "Document")}</p>
                  {formatBytes(f.size) && (
                    <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(f.url)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${f.name || "file"}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!full && (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {uploading > 0
            ? `Uploading ${uploading} file${uploading === 1 ? "" : "s"}…`
            : value.length > 0
              ? "Add more files"
              : label}
          {uploading === 0 && hint && (
            <span className="text-xs text-muted-foreground/70">· {hint}</span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={onPick}
            disabled={uploading > 0}
          />
        </label>
      )}
      {full && (
        <p className="text-xs text-muted-foreground">Maximum of {max} files reached.</p>
      )}
    </div>
  );
}

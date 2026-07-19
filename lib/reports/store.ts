import "server-only";
import { put } from "@vercel/blob";

/**
 * Store a generated report PDF and return a public, unguessable URL — or `null`
 * when no persistent store is available (serverless with no Blob token). In that
 * case the /r/[id] route regenerates the PDF from the archived report data, so
 * the system works with or without Blob.
 *
 * - Vercel Blob (token present): upload → public CDN URL (opens inline, no login).
 * - Local dev (no token, not on Vercel): write to /public/reports.
 * - Serverless without Blob: return null → regenerate on view.
 */
export async function storeReportPdf(bytes: Uint8Array, filename: string): Promise<string | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`reports/${filename}`, Buffer.from(bytes), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    return blob.url;
  }
  if (!process.env.VERCEL) {
    // Local dev only — the read-only Vercel filesystem can't be written to.
    const { writeFile, mkdir } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "public", "reports");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(bytes));
    return `/reports/${filename}`;
  }
  return null;
}

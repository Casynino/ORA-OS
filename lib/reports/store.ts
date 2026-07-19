import "server-only";
import { put } from "@vercel/blob";

/**
 * Store a generated report PDF and return a public, unguessable URL.
 * Production: Vercel Blob (`access: "public"`, random suffix → the "secure link,
 * no login" the CEO opens). Local dev (no Blob token): writes to
 * /public/reports and returns a relative path served statically.
 */
export async function storeReportPdf(bytes: Uint8Array, filename: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`reports/${filename}`, Buffer.from(bytes), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    return blob.url;
  }
  // Local dev fallback.
  const { writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "reports");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(bytes));
  return `/reports/${filename}`;
}

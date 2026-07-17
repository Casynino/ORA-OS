import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireActor } from "@/lib/rbac";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (images are compressed client-side)
const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];

export async function POST(req: Request) {
  try {
    // Admins upload branding/photos; reps attach payment proof at point of
    // sale; finance attaches deposit slips + office-fund receipts.
    await requireActor(["ADMIN", "FINANCE", "SALES_REP"]);
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 8MB)." }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() ?? "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (ext && !ALLOWED.includes(ext)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || `image/${ext || "jpeg"}`;
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;

    // Preferred: Vercel Blob (scales, keeps DB rows lean). Falls back to an
    // inline data URL if Blob isn't configured OR the upload fails — so proof
    // capture never hard-blocks a sale, even on Vercel's read-only filesystem.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`uploads/${name}`, bytes, {
          access: "public",
          contentType,
        });
        return NextResponse.json({ url: blob.url });
      } catch (e) {
        console.error("Vercel Blob upload failed, using inline data URL:", e);
      }
    }

    // Inline data URL — self-contained, no external storage required.
    return NextResponse.json({
      url: `data:${contentType};base64,${bytes.toString("base64")}`,
    });
  } catch (e) {
    console.error("Upload failed:", e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

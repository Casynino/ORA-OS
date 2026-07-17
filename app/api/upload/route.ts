import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { requireActor } from "@/lib/rbac";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif"];

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
      return NextResponse.json({ error: "Image is too large (max 6MB)." }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() ?? "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Production (Vercel) has a read-only filesystem → store in Vercel Blob.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${name}`, bytes, {
        access: "public",
        contentType: file.type || `image/${ext}`,
      });
      return NextResponse.json({ url: blob.url });
    }

    // Local development → write to public/uploads.
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return NextResponse.json({ url: `/uploads/${name}` });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

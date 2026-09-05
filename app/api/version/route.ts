import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/build-id";

/**
 * Which build of ORA is currently being served. Never cached — a cached answer
 * to "are you still the version I loaded?" would say yes forever.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { build: BUILD_ID },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
      },
    },
  );
}

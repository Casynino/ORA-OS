import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/rbac";

// Tells the dashboard whether a Developer is currently working as a staff member
// (so it can show the "Working as … — recorded as <Developer>" banner).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.impersonatedBy) return NextResponse.json({ acting: false }, { headers: NO_STORE });
  return NextResponse.json(
    {
      acting: true,
      as: { name: user.name ?? "", role: user.role },
      developer: user.impersonatedBy.name,
    },
    { headers: NO_STORE },
  );
}

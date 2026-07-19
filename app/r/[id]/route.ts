import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public report link — /r/<reportId>. No login required (the link is the
 * capability, like the Blob URL itself). Redirects straight to the archived PDF
 * so it opens in the browser. This gives an ORA-branded, stable, revocable link.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id }, select: { pdfUrl: true } });
  if (!report?.pdfUrl) return new NextResponse("Report not found.", { status: 404 });
  // Handles both absolute (Blob) and relative (local dev) URLs.
  return NextResponse.redirect(new URL(report.pdfUrl, req.url));
}

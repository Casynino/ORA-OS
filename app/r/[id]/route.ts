import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDailyReportPdf } from "@/lib/reports/daily-pdf";
import { buildMonthlyReportPdf } from "@/lib/reports/monthly-pdf";
import type { DailyReportData } from "@/lib/reports/daily-data";
import type { MonthlyReportData } from "@/lib/reports/monthly-data";

export const dynamic = "force-dynamic";

/**
 * Public report link — /r/<reportId>. No login required (the link is the
 * capability). If the PDF was stored (Vercel Blob) we redirect to it; otherwise
 * we regenerate it on the fly from the archived report data and stream it inline
 * — so the system works whether or not Blob storage is configured.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    select: { pdfUrl: true, type: true, summary: true, title: true },
  });
  if (!report) return new NextResponse("Report not found.", { status: 404 });

  if (report.pdfUrl) return NextResponse.redirect(new URL(report.pdfUrl, req.url));

  const bytes =
    report.type === "MONTHLY"
      ? buildMonthlyReportPdf(report.summary as unknown as MonthlyReportData)
      : buildDailyReportPdf(report.summary as unknown as DailyReportData);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(report.title || "report").replace(/[^\w.-]+/g, "-")}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

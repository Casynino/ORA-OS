import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ORA brand (magenta → purple).
export const BRAND = { magenta: [192, 25, 127] as [number, number, number], purple: [98, 54, 170] as [number, number, number], ink: [30, 30, 40] as [number, number, number], muted: [120, 120, 135] as [number, number, number] };

export function tsh(n: number): string {
  return "TSh " + Math.round(n).toLocaleString("en-US");
}

/** A branded A4 doc with the ORA header band. Returns the doc + the y to start at. */
export function newReportDoc(title: string, subtitle: string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  // Header band
  doc.setFillColor(...BRAND.magenta);
  doc.rect(0, 0, w, 26, "F");
  doc.setFillColor(...BRAND.purple);
  doc.rect(w - 6, 0, 6, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 20);
  doc.setTextColor(...BRAND.ink);
  return doc;
}

/** Current y position after the last autoTable (falls back to a default). */
function lastY(doc: jsPDF, fallback: number): number {
  // @ts-expect-error jspdf-autotable attaches lastAutoTable
  const y = doc.lastAutoTable?.finalY;
  return typeof y === "number" ? y : fallback;
}

/** A section heading + a 2-column key/value table. Returns the y after it. */
export function kvSection(doc: jsPDF, y: number, heading: string, rows: [string, string][]): number {
  y = ensureSpace(doc, y, 14 + rows.length * 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.magenta);
  doc.text(heading, 14, y);
  doc.setTextColor(...BRAND.ink);
  autoTable(doc, {
    startY: y + 2,
    body: rows,
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.6, textColor: BRAND.ink },
    columnStyles: { 0: { textColor: BRAND.muted, cellWidth: 70 }, 1: { fontStyle: "bold", halign: "left" } },
    margin: { left: 14, right: 14 },
  });
  return lastY(doc, y + 10) + 6;
}

/** A section heading + a full data table with a coloured header. */
export function tableSection(doc: jsPDF, y: number, heading: string, head: string[], body: (string | number)[][]): number {
  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.magenta);
  doc.text(heading, 14, y);
  doc.setTextColor(...BRAND.ink);
  if (body.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text("No activity recorded.", 14, y + 6);
    doc.setTextColor(...BRAND.ink);
    return y + 12;
  }
  autoTable(doc, {
    startY: y + 2,
    head: [head],
    body,
    theme: "striped",
    headStyles: { fillColor: BRAND.purple, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2, textColor: BRAND.ink },
    margin: { left: 14, right: 14 },
  });
  return lastY(doc, y + 12) + 6;
}

/** A highlighted paragraph block (executive summary / insights). */
export function noteBlock(doc: jsPDF, y: number, heading: string, lines: string[]): number {
  y = ensureSpace(doc, y, 14 + lines.length * 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.magenta);
  doc.text(heading, 14, y);
  doc.setTextColor(...BRAND.ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  let yy = y + 6;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(`•  ${line}`, doc.internal.pageSize.getWidth() - 28);
    doc.text(wrapped, 14, yy);
    yy += wrapped.length * 5;
  }
  return yy + 4;
}

/** Page-break helper: if not enough vertical space, add a page and reset y. */
export function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + need > h - 16) {
    doc.addPage();
    return 20;
  }
  return y;
}

/** Footer on every page + return PDF bytes. */
export function finalizeDoc(doc: jsPDF): Uint8Array {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const stamp = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" }).format(new Date());
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 228);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND.muted);
    doc.text(`ORA OS · Generated ${stamp} (EAT) · Confidential`, 14, h - 7);
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 7, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

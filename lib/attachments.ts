// Shared, client-safe attachment types & helpers. NO prisma / server imports
// here — this file is imported by client components (the uploader/viewer) as
// well as server code. The server-side data helpers live in
// lib/services/attachments.ts.

/** What the uploader hands to a server action after a file is stored. */
export type AttachmentInput = {
  url: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
};

/** A stored attachment as read back for display. */
export type AttachmentDTO = {
  id: string;
  url: string;
  name: string | null;
  contentType: string | null;
  size: number | null;
  createdAt?: Date | string | null;
};

/** The stable string tags used for Attachment.entityType across the system. */
export const ATTACHMENT_ENTITIES = {
  EXPENSE: "Expense",
  FIELD_SALE: "FieldSale",
  FIELD_PAYMENT: "FieldPayment",
  CASH_DEPOSIT: "CashDeposit",
  CAPITAL_ENTRY: "CapitalEntry",
  EXPENSE_CLAIM_ITEM: "ExpenseClaimItem",
  OPERATIONAL_SPEND: "OperationalSpend",
  PETTY_CASH_EXPENSE: "PettyCashExpense",
} as const;

export type AttachmentEntity =
  (typeof ATTACHMENT_ENTITIES)[keyof typeof ATTACHMENT_ENTITIES];

/** True when the file should be shown as an inline image preview. */
export function isImageAttachment(a: {
  contentType?: string | null;
  url?: string | null;
}): boolean {
  if (a.contentType) {
    if (/^image\//i.test(a.contentType)) return true;
    if (/pdf/i.test(a.contentType)) return false;
  }
  const url = a.url ?? "";
  if (/^data:image\//i.test(url)) return true;
  if (/^data:application\/pdf/i.test(url)) return false;
  if (/\.pdf($|\?)/i.test(url)) return false;
  // Blob URLs carry the extension in the path.
  if (/\.(jpe?g|png|webp|gif)($|\?)/i.test(url)) return true;
  // Unknown → assume image (the historical default was image-only).
  return true;
}

export function isPdfAttachment(a: {
  contentType?: string | null;
  url?: string | null;
}): boolean {
  if (a.contentType && /pdf/i.test(a.contentType)) return true;
  const url = a.url ?? "";
  return /^data:application\/pdf/i.test(url) || /\.pdf($|\?)/i.test(url);
}

/** Human-readable file size, e.g. "1.2 MB". Returns "" when unknown. */
export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

/**
 * Merge a legacy single-file column with the attachment rows for display, so old
 * records (which only have receiptUrl / slipUrl / paymentProofUrl) still show,
 * and never duplicate the legacy URL if it's already in the attachment list.
 * The legacy file is shown first.
 */
export function mergeLegacyAttachments(
  legacyUrl: string | null | undefined,
  attachments: AttachmentDTO[] = [],
): AttachmentDTO[] {
  const rows = [...attachments];
  if (legacyUrl && !rows.some((a) => a.url === legacyUrl)) {
    rows.unshift({
      id: `legacy:${legacyUrl}`,
      url: legacyUrl,
      name: null,
      contentType: null,
      size: null,
      createdAt: null,
    });
  }
  return rows;
}

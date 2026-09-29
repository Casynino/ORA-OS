import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AttachmentInput, AttachmentDTO, AttachmentEntity } from "@/lib/attachments";

// One uploaded file as the client sends it to a server action. The url can be a
// hosted blob URL or an inline data: URL (hence the large max), matching the
// existing single-file receiptUrl limits elsewhere.
export const attachmentInputSchema = z.object({
  url: z.string().min(1).max(15000000),
  name: z.string().max(300).nullish(),
  contentType: z.string().max(120).nullish(),
  size: z.number().int().nonnegative().max(50000000).nullish(),
});

/** Optional array of uploaded files on an action's input. */
export const attachmentsInputSchema = z.array(attachmentInputSchema).max(30).optional();

/**
 * Resolve the files to store from an action's input, tolerating BOTH the new
 * `attachments` array and a legacy single `url` string (so old callers keep
 * working). Returns a de-duped list; files[0]?.url is what to write into the
 * legacy single column.
 */
export function filesFromInput(
  attachments: AttachmentInput[] | undefined | null,
  legacyUrl?: string | null,
): AttachmentInput[] {
  const clean = dedupeFiles(attachments);
  if (clean.length > 0) return clean;
  const url = (legacyUrl ?? "").trim();
  return url ? [{ url }] : [];
}

// Server-side data helpers for the generic Attachment table. Use these to write
// and read the MULTIPLE files that belong to a transaction. The legacy single
// column (receiptUrl / slipUrl / paymentProofUrl) still holds the FIRST file so
// existing screens keep working — set it to files[0]?.url when you create a row.

/** Accepts the base client or a $transaction client. */
type Db = Prisma.TransactionClient | typeof prisma;

const SELECT = {
  id: true,
  url: true,
  name: true,
  contentType: true,
  size: true,
  createdAt: true,
} satisfies Prisma.AttachmentSelect;

/**
 * Persist a set of uploaded files against an entity. De-dupes by URL and drops
 * blanks. Safe to call inside a transaction (pass the tx client). Returns the
 * number of rows created.
 */
export async function createAttachments(
  db: Db,
  entityType: AttachmentEntity | string,
  entityId: string,
  files: AttachmentInput[] | undefined | null,
  uploadedById?: string | null,
): Promise<number> {
  const clean = dedupeFiles(files);
  if (clean.length === 0) return 0;
  await db.attachment.createMany({
    data: clean.map((f) => ({
      entityType,
      entityId,
      url: f.url,
      name: f.name ?? null,
      contentType: f.contentType ?? null,
      size: typeof f.size === "number" ? f.size : null,
      uploadedById: uploadedById ?? null,
    })),
  });
  return clean.length;
}

/**
 * Attach files AFTER the money transaction has committed — best-effort, never
 * throws. Use this instead of calling createAttachments inside the money tx:
 * a failure here (missing table, DB hiccup) then can't roll back the sale/
 * expense/deposit. The first file is already saved in the legacy single column
 * inside the tx, so the primary proof is never lost even if this fails.
 */
export async function attachAfterCommit(
  entityType: AttachmentEntity | string,
  entityId: string,
  files: AttachmentInput[] | undefined | null,
  uploadedById?: string | null,
): Promise<void> {
  try {
    await createAttachments(prisma, entityType, entityId, files, uploadedById);
  } catch (e) {
    console.error("[attachAfterCommit]", entityType, entityId, e instanceof Error ? e.message : e);
  }
}

/** Normalise an uploader payload: trim, drop empties, de-dupe by URL. */
export function dedupeFiles(files: AttachmentInput[] | undefined | null): AttachmentInput[] {
  if (!Array.isArray(files)) return [];
  const seen = new Set<string>();
  const out: AttachmentInput[] = [];
  for (const f of files) {
    const url = (f?.url ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, name: f.name ?? null, contentType: f.contentType ?? null, size: f.size ?? null });
  }
  return out;
}

/** All attachments for one entity, oldest first. Degrades to [] if the table
 *  isn't migrated yet, so a read never 500s the page. */
export async function getAttachmentsFor(
  entityType: AttachmentEntity | string,
  entityId: string,
): Promise<AttachmentDTO[]> {
  try {
    const rows = await prisma.attachment.findMany({
      where: { entityType, entityId },
      select: SELECT,
      orderBy: { createdAt: "asc" },
    });
    return rows;
  } catch (e) {
    console.error("[getAttachmentsFor]", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Attachments for MANY entities in one query — returns a map keyed by entityId
 * so list/table screens don't N+1. Missing ids simply have no key.
 */
export async function getAttachmentsMap(
  entityType: AttachmentEntity | string,
  entityIds: string[],
): Promise<Record<string, AttachmentDTO[]>> {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const map: Record<string, AttachmentDTO[]> = {};
  try {
    const rows = await prisma.attachment.findMany({
      where: { entityType, entityId: { in: ids } },
      select: { ...SELECT, entityId: true },
      orderBy: { createdAt: "asc" },
    });
    for (const r of rows) {
      (map[r.entityId] ??= []).push({
        id: r.id,
        url: r.url,
        name: r.name,
        contentType: r.contentType,
        size: r.size,
        createdAt: r.createdAt,
      });
    }
  } catch (e) {
    // Table not migrated yet, or a transient read failure — degrade to "no extra
    // attachments" so the legacy single proof still shows and the page never 500s.
    console.error("[getAttachmentsMap]", e instanceof Error ? e.message : e);
  }
  return map;
}

/**
 * Delete every attachment for the given entities — call inside the transaction
 * that hard-deletes the owning rows (e.g. a customer/sale reversal) so no files
 * are orphaned.
 */
export async function deleteAttachmentsFor(
  db: Db,
  entityType: AttachmentEntity | string,
  entityIds: string[],
): Promise<void> {
  const ids = entityIds.filter(Boolean);
  if (ids.length === 0) return;
  await db.attachment.deleteMany({ where: { entityType, entityId: { in: ids } } });
}

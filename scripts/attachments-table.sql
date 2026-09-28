-- Multiple Attachments — production Neon migration (additive, safe).
-- Creates ONE new table used by every transaction to hold MULTIPLE uploaded
-- documents/proofs. Touches no existing table or column, so it can't affect
-- current data. Run this against production Neon BEFORE deploying the new code.
--
-- Easiest: `npx prisma db push` with the Neon DATABASE_URL/DIRECT_URL set.
-- Or paste this whole file into the Neon SQL editor. It is idempotent.

CREATE TABLE IF NOT EXISTS "Attachment" (
    "id"           TEXT NOT NULL,
    "url"          TEXT NOT NULL,
    "name"         TEXT,
    "contentType"  TEXT,
    "size"         INTEGER,
    "entityType"   TEXT NOT NULL,
    "entityId"     TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Attachment_entityType_entityId_idx"
    ON "Attachment" ("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "Attachment_createdAt_idx"
    ON "Attachment" ("createdAt");

-- Uploader FK → User (nullable, SET NULL on user delete). Guarded so re-runs
-- don't error on an already-present constraint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Attachment_uploadedById_fkey'
    ) THEN
        ALTER TABLE "Attachment"
            ADD CONSTRAINT "Attachment_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

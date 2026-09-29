-- In-app notifications — production Neon migration (additive, safe).
-- Creates ONE new enum + ONE new table for the notification bell/sound. Touches
-- no existing table or column. Run against production Neon BEFORE deploying:
--   npx prisma db execute --url "postgresql://…neon…?sslmode=require" --file scripts/notifications-table.sql
-- Idempotent — safe to re-run. Uses the existing "Role" enum for role broadcasts.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationCategory') THEN
    CREATE TYPE "NotificationCategory" AS ENUM ('ACTION', 'INFO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT,
    "role"        "Role",
    "category"    "NotificationCategory" NOT NULL DEFAULT 'INFO',
    "type"        TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "actorName"   TEXT,
    "entityType"  TEXT,
    "entityId"    TEXT,
    "actionUrl"   TEXT,
    "actionLabel" TEXT,
    "readAt"      TIMESTAMP(3),
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_resolvedAt_createdAt_idx"
    ON "Notification" ("userId", "resolvedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_role_resolvedAt_createdAt_idx"
    ON "Notification" ("role", "resolvedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx"
    ON "Notification" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
    ON "Notification" ("createdAt");

-- Recipient FK → User (nullable; cascade so a deleted user's notifications go too).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

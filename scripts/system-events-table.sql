-- SystemEvent: technical events (server errors, failed sign-ins) for the Developer console.
-- Additive and idempotent. The Developer console's "Turn on error tracking" button runs
-- exactly this; it is kept here so it can also be applied by hand.
CREATE TABLE IF NOT EXISTS "SystemEvent" (
  "id"        TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "path"      TEXT,
  "method"    TEXT,
  "digest"    TEXT,
  "detail"    TEXT,
  "ip"        TEXT,
  "count"     INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "SystemEvent_kind_createdAt_idx" ON "SystemEvent"("kind", "createdAt");
ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "count" INTEGER NOT NULL DEFAULT 1;

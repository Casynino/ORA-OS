// Executive reporting tables — Report + ReportSettings (+ ReportType enum).
// Additive only; run on Neon BEFORE deploying.
//   DATABASE_URL=<neon-direct-url> node scripts/migrate-reports.mjs
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "(unknown host)";
const run = (sql) => p.$executeRawUnsafe(sql);

try {
  console.log(`→ Creating Report + ReportSettings on ${host}`);
  await run(`DO $$ BEGIN CREATE TYPE "ReportType" AS ENUM ('DAILY','MONTHLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
  await run(`
    CREATE TABLE IF NOT EXISTS "Report" (
      "id" TEXT NOT NULL,
      "type" "ReportType" NOT NULL,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3),
      "title" TEXT NOT NULL,
      "summary" JSONB NOT NULL,
      "pdfUrl" TEXT,
      "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
      "recipients" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
    );`);
  await run(`CREATE INDEX IF NOT EXISTS "Report_type_periodStart_idx" ON "Report"("type","periodStart");`);
  await run(`CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt");`);
  await run(`
    CREATE TABLE IF NOT EXISTS "ReportSettings" (
      "id" TEXT NOT NULL DEFAULT 'singleton',
      "dailyEnabled" BOOLEAN NOT NULL DEFAULT true,
      "dailyHourEat" INTEGER NOT NULL DEFAULT 19,
      "monthlyEnabled" BOOLEAN NOT NULL DEFAULT true,
      "creditReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
      "fundRequestAlerts" BOOLEAN NOT NULL DEFAULT true,
      "repReportAlerts" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReportSettings_pkey" PRIMARY KEY ("id")
    );`);
  console.log("✓ Done — Report + ReportSettings present.");
} catch (e) {
  console.error("✗ Migration failed:", e.message);
  process.exit(1);
} finally {
  await p.$disconnect();
}

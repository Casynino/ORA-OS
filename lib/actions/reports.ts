"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { generateDailyReport } from "@/lib/reports/generate-daily";
import { generateMonthlyReport } from "@/lib/reports/generate-monthly";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

/** ADMIN: generate a report right now (and optionally WhatsApp it to the CEO). */
export async function generateReportNow(
  type: "DAILY" | "MONTHLY",
  send: boolean,
): Promise<ActionResult<{ link: string }>> {
  try {
    await requireRole("ADMIN");
    const res = type === "MONTHLY"
      ? await generateMonthlyReport(new Date(), { send })
      : await generateDailyReport(new Date(), { send });
    revalidatePath("/admin/reports");
    const msg = !send
      ? "Report generated and archived."
      : res.whatsapp.ok
        ? "Report generated and sent to WhatsApp."
        : res.whatsapp.skipped
          ? "Report generated. WhatsApp is not configured in this environment."
          : `Report generated, but WhatsApp failed: ${res.whatsapp.error}`;
    return ok({ link: res.link }, msg);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const settingsSchema = z.object({
  dailyEnabled: z.boolean(),
  dailyHourEat: z.number().int().min(0).max(23),
  monthlyEnabled: z.boolean(),
  creditReminderEnabled: z.boolean(),
  fundRequestAlerts: z.boolean(),
  repReportAlerts: z.boolean(),
});

/** ADMIN: update the executive-reporting settings (toggles + daily send hour). */
export async function updateReportSettings(input: z.infer<typeof settingsSchema>): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    const d = settingsSchema.parse(input);
    await prisma.reportSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...d },
      update: d,
    });
    revalidatePath("/admin/reports");
    return ok(undefined, "Report settings saved.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** ADMIN: send a one-off test WhatsApp to confirm the integration works. */
export async function sendTestWhatsApp(): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    const res = await sendWhatsApp("✅ ORA OS — test message. Your executive WhatsApp notifications are working.");
    if (res.ok) return ok(undefined, "Test message sent — check WhatsApp.");
    if (res.skipped) return fail("WhatsApp isn't configured (missing CALLMEBOT_PHONE / CALLMEBOT_APIKEY) or is disabled in this environment.");
    return fail(`WhatsApp failed: ${res.error}`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

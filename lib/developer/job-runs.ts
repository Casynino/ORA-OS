import "server-only";
import type { NextResponse } from "next/server";
import { recordOpsEvent } from "@/lib/developer/ops-events";

/** The scheduled jobs the Developer Home tracks (keys are stored in SystemEvent.message). */
export const JOB_KEYS = ["daily-report", "credit-reminder"] as const;
export type JobKey = (typeof JOB_KEYS)[number];

type WaLike = { ok?: boolean; skipped?: boolean; reason?: string } | null | undefined;

/**
 * Run a cron route's work and write down that it ran: when, how long, and how it
 * ended. Call it AFTER the secret check so unauthorised calls leave no trace. The
 * response is returned untouched; a thrown error is recorded and then re-thrown.
 */
export async function withJobRun(job: JobKey, run: () => Promise<NextResponse>): Promise<NextResponse> {
  const t0 = Date.now();
  try {
    const res = await run();
    let ok = res.status < 400;
    let note: string | null = null;
    try {
      const b = (await res.clone().json()) as {
        ok?: boolean;
        skipped?: string;
        whatsapp?: WaLike;
        daily?: { whatsapp?: WaLike } | string | null;
        monthly?: { whatsapp?: WaLike } | string | null;
      } | null;
      if (b && typeof b === "object") {
        if (b.ok === false) ok = false;
        if (typeof b.skipped === "string") note = `Skipped: ${b.skipped}`;
        const attempts: WaLike[] = [
          b.whatsapp,
          typeof b.daily === "object" ? b.daily?.whatsapp : null,
          typeof b.monthly === "object" ? b.monthly?.whatsapp : null,
        ];
        const failed = attempts.find((w) => w && w.ok === false && !w.skipped);
        if (failed) {
          ok = false;
          note = `Ran, but WhatsApp did not deliver${failed.reason ? `: ${failed.reason}` : ""}`;
        } else if (!note && attempts.some((w) => w && w.skipped)) {
          note = "WhatsApp is switched off or not set up";
        }
      }
    } catch {
      // Not JSON: nothing more to say about the result.
    }
    await recordOpsEvent({ kind: "JOB_RUN", message: job, detail: JSON.stringify({ ok, ms: Date.now() - t0, note }) });
    return res;
  } catch (e) {
    await recordOpsEvent({
      kind: "JOB_RUN",
      message: job,
      detail: JSON.stringify({ ok: false, ms: Date.now() - t0, note: (e instanceof Error ? e.message : String(e)).slice(0, 200) }),
    });
    throw e;
  }
}

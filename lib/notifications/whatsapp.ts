import "server-only";

const BASE = "https://api.callmebot.com/whatsapp.php";

export type WhatsAppResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string; // why it skipped/failed (for diagnostics)
  status?: number;
  body?: string;
  error?: string;
};

/**
 * Send a WhatsApp message to the CEO via CallMeBot.
 *
 * Fire-and-forget by contract: this NEVER throws — a notification failure must
 * never break the business action that triggered it. When credentials are
 * missing or NOTIFICATIONS_DISABLED=1 (local dev), it logs instead of sending so
 * we don't spam a real phone while developing.
 *
 * CallMeBot is rate-limited; keep sends to genuinely important events only.
 */
export async function sendWhatsApp(
  text: string,
  opts?: { phone?: string; apikey?: string },
): Promise<WhatsAppResult> {
  const phone = opts?.phone ?? process.env.CALLMEBOT_PHONE;
  const apikey = opts?.apikey ?? process.env.CALLMEBOT_APIKEY;

  if (process.env.NOTIFICATIONS_DISABLED === "1") {
    console.log(`[whatsapp:disabled]\n${text}`);
    return { ok: false, skipped: true, reason: "NOTIFICATIONS_DISABLED=1" };
  }
  if (!phone || !apikey) {
    const missing = [!phone && "CALLMEBOT_PHONE", !apikey && "CALLMEBOT_APIKEY"].filter(Boolean).join(", ");
    console.log(`[whatsapp:skipped] missing ${missing}\n${text}`);
    return { ok: false, skipped: true, reason: `missing ${missing}` };
  }

  const url = `${BASE}?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;

  // These are business-critical alerts (fund requests, confirmed payments), so a
  // single transient CallMeBot hiccup must not silently drop them — we retry.
  // BUT this runs awaited AFTER the DB commit of the triggering action, so the
  // total time is HARD-CAPPED (well under any serverless limit) to guarantee the
  // function returns and the user never sees a false failure that prompts a
  // duplicate resubmit. The cap (15s) is below the original single-attempt
  // budget (20s), so this is both more reliable AND faster in the worst case.
  const DEADLINE_MS = 15000;
  const PER_ATTEMPT_MS = 8000;
  const started = Date.now();
  let last: WhatsAppResult = { ok: false, reason: "not attempted" };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining <= 500) break; // out of budget — stop rather than risk a kill
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(Math.min(PER_ATTEMPT_MS, remaining)),
      });
      const body = (await res.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const queued = /queued|will receive|message to/i.test(body);
      if (res.ok && queued) {
        return { ok: true, status: res.status, body: body.slice(0, 300) };
      }
      last = { ok: false, status: res.status, body: body.slice(0, 300), reason: "CallMeBot did not queue the message" };
      console.error(`[whatsapp:not-delivered attempt ${attempt}/3] HTTP ${res.status}: ${body.slice(0, 200)}`);
    } catch (e) {
      last = { ok: false, error: e instanceof Error ? e.message : String(e), reason: "request failed" };
      console.error(`[whatsapp:error attempt ${attempt}/3]`, e);
    }
    // Brief back-off before retrying, but never past the deadline.
    const budget = DEADLINE_MS - (Date.now() - started);
    if (attempt < 3 && budget > 1500) await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, budget - 500)));
    else break;
  }
  return last;
}

/** Public base URL for building report links in messages. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://ora-os-eight.vercel.app"
  );
}

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

  try {
    const url = `${BASE}?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20000) });
    const body = (await res.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const queued = /queued|will receive|message to/i.test(body);
    if (!res.ok || !queued) {
      console.error(`[whatsapp:not-delivered] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return { ok: false, status: res.status, body: body.slice(0, 300), reason: "CallMeBot did not queue the message" };
    }
    return { ok: true, status: res.status, body: body.slice(0, 300) };
  } catch (e) {
    console.error("[whatsapp:error]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e), reason: "request failed" };
  }
}

/** Public base URL for building report links in messages. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://ora-os-eight.vercel.app"
  );
}

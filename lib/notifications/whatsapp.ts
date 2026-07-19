import "server-only";

const BASE = "https://api.callmebot.com/whatsapp.php";

export type WhatsAppResult = { ok: boolean; skipped?: boolean; error?: string };

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

  if (process.env.NOTIFICATIONS_DISABLED === "1" || !phone || !apikey) {
    console.log(`[whatsapp:skipped]\n${text}`);
    return { ok: false, skipped: true };
  }

  try {
    const url = `${BASE}?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20000) });
    const body = await res.text().catch(() => "");
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 160)}` };
    return { ok: true };
  } catch (e) {
    console.error("[whatsapp:error]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Public base URL for building report links in messages. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://ora-os-eight.vercel.app"
  );
}

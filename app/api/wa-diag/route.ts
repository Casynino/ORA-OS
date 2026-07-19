import { NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";

export const dynamic = "force-dynamic";

/**
 * WhatsApp / reporting diagnostics. Reports which environment variables the
 * DEPLOYED app can see (booleans only — never the values), so misconfiguration
 * is obvious. `?send=1&secret=<CRON_SECRET>` also fires a live test and returns
 * CallMeBot's raw response.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = {
    callmebotPhoneSet: !!process.env.CALLMEBOT_PHONE,
    callmebotApikeySet: !!process.env.CALLMEBOT_APIKEY,
    notificationsDisabled: process.env.NOTIFICATIONS_DISABLED === "1",
    cronSecretSet: !!process.env.CRON_SECRET,
    blobTokenSet: !!process.env.BLOB_READ_WRITE_TOKEN,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    onVercel: !!process.env.VERCEL,
  };

  if (url.searchParams.get("send") === "1") {
    if (!process.env.CRON_SECRET || url.searchParams.get("secret") !== process.env.CRON_SECRET) {
      return NextResponse.json({ env, send: "unauthorized — add ?secret=<CRON_SECRET>" }, { status: 401 });
    }
    const send = await sendWhatsApp("ORA OS diagnostic — this confirms the deployed app can send WhatsApp.");
    return NextResponse.json({ env, send });
  }

  return NextResponse.json({ env });
}

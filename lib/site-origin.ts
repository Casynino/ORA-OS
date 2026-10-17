import "server-only";
import { headers } from "next/headers";

/**
 * The address the visitor is actually on (https://www.ora.co.tz, or the vercel.app
 * address while testing). Used for share links and social-preview images so a link
 * shared from the real domain stays on the real domain, whatever NEXT_PUBLIC_APP_URL says.
 */
export async function siteOrigin(): Promise<string> {
  const fallback = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.ora.co.tz").replace(/\/$/, "");
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
    if (!/^[a-z0-9.-]+(:\d{2,5})?$/i.test(host)) return fallback;
    const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  } catch {
    return fallback;
  }
}

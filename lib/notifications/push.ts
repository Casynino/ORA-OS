import "server-only";
import * as webpush from "web-push";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Phone / desktop pop-ups for ORA alerts (Web Push).
 *
 * Why this exists: the bell used to ask the database "anything new?" every few seconds on every open page, which
 * kept the database awake all day and used up its monthly data transfer. With push, the server sends a pop-up to the
 * devices that opted in ONLY when an alert is created (lib/notifications/in-app.ts → notifyInApp), so nothing has to ask.
 *
 * Like every notifier here it must NEVER break the workflow that triggered it: everything is wrapped, nothing throws,
 * and if the keys (VAPID_*) or the PushSubscription table are missing it quietly does nothing (the bell's slow
 * check still delivers alerts to anyone who has not turned push on).
 *
 * The message is encrypted end to end to each device (RFC 8291); Google / Apple / Mozilla only carry it.
 */

// The three Vercel settings: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: address, optional).
const publicKey = () => process.env.VAPID_PUBLIC_KEY || null;
const privateKey = () => process.env.VAPID_PRIVATE_KEY || null;
const subject = () => process.env.VAPID_SUBJECT || "mailto:info@ora.co.tz";

export const pushConfigured = (): boolean => !!(publicKey() && privateKey());
export const pushPublicKey = (): string | null => publicKey();

let armed = false;
function arm(): boolean {
  if (!pushConfigured()) return false;
  if (!armed) {
    webpush.setVapidDetails(subject(), publicKey()!, privateKey()!);
    armed = true;
  }
  return true;
}

// Push services we accept subscriptions from. The server will POST to the address a signed-in user hands over, so an
// open list would let someone point it at an internal address; only the real push services are allowed.
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge, Brave, Opera, Samsung Internet, Android
  "updates.push.services.mozilla.com", // Firefox
  ".push.apple.com", // Safari / iPhone Home Screen app (web.push.apple.com)
  ".notify.windows.com", // Windows / Edge
];
const B64URL = /^[A-Za-z0-9_-]+$/;
const MAX_DEVICES_PER_USER = 10;

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Parse what the browser's PushSubscription.toJSON() produced; null if it is not a believable push subscription. */
export function parseSubscription(raw: unknown): PushSubscriptionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof r.endpoint === "string" ? r.endpoint.trim() : "";
  const p256dh = typeof r.keys?.p256dh === "string" ? r.keys.p256dh : "";
  const auth = typeof r.keys?.auth === "string" ? r.keys.auth : "";
  if (!endpoint || endpoint.length > 2048 || !B64URL.test(p256dh) || !B64URL.test(auth)) return null;
  if (p256dh.length < 80 || p256dh.length > 100 || auth.length < 16 || auth.length > 32) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const allowed = PUSH_HOSTS.some((h) => (h.startsWith(".") ? host.endsWith(h) : host === h));
  return allowed ? { endpoint, keys: { p256dh, auth } } : null;
}

/** Remember this device for this user (a device that signs in as someone else moves to them). Throws if the table is missing. */
export async function savePushSubscription(userId: string, sub: PushSubscriptionInput, userAgent?: string | null): Promise<void> {
  const ua = userAgent ? userAgent.slice(0, 200) : null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: ua },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: ua },
  });
  // Keep the newest few devices per person (old phones / reinstalls would otherwise pile up and be pushed to forever).
  const mine = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  if (mine.length > MAX_DEVICES_PER_USER) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: mine.slice(MAX_DEVICES_PER_USER).map((m) => m.id) } } });
  }
}

/** Forget a device (only this user's own). Throws if the table is missing. */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export type PushAlert = {
  toUserId?: string | null;
  toRoles?: Role[];
  title: string;
  body: string;
  /** Same-site path to open when the pop-up is tapped. */
  url?: string | null;
  /** Same tag = the newer pop-up replaces the older one (an ACTION that is nudged again). */
  tag?: string;
  /** ACTION alerts are sent as high priority so they wake a sleeping phone. */
  urgent?: boolean;
};

/** Send a pop-up to every opted-in device of the target user and/or everyone ACTIVE in the target roles. Never throws. */
export async function sendPushToAudience(alert: PushAlert): Promise<void> {
  try {
    if (!arm()) return;
    const roles = Array.from(new Set(alert.toRoles ?? []));
    const audience: Prisma.PushSubscriptionWhereInput[] = [];
    if (alert.toUserId) audience.push({ userId: alert.toUserId });
    if (roles.length) audience.push({ user: { role: { in: roles } } });
    if (audience.length === 0) return;

    const subs = await prisma.pushSubscription.findMany({
      where: { user: { status: "ACTIVE" }, OR: audience },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
      take: 500,
    });
    if (subs.length === 0) return;

    const url = alert.url && alert.url.startsWith("/") && !alert.url.startsWith("//") ? alert.url : "/";
    const payload = JSON.stringify({
      title: alert.title.slice(0, 120),
      body: alert.body.slice(0, 240), // a push message must stay well under 4 KB
      url,
      tag: alert.tag ?? undefined,
    });
    const options = { TTL: 6 * 60 * 60, urgency: alert.urgent ? ("high" as const) : ("normal" as const), timeout: 8000 };

    const results = await Promise.allSettled(
      subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options)),
    );
    const gone: string[] = [];
    const delivered: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") delivered.push(subs[i].id);
      else {
        const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
        if (code === 404 || code === 410) gone.push(subs[i].id); // the device removed ORA / revoked permission
        else console.error("[push] send failed", code ?? "", r.reason instanceof Error ? r.reason.message : "");
      }
    });
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    if (delivered.length) await prisma.pushSubscription.updateMany({ where: { id: { in: delivered } }, data: { lastPushAt: new Date() } });
  } catch (e) {
    console.error("[push]", e instanceof Error ? e.message : e);
  }
}

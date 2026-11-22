"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Phone / desktop pop-up alerts for the notification bell (Web Push).
 *
 * With a device subscribed, the server sends the pop-up the moment an alert is created, so this page never has to keep
 * asking the database "anything new?". Subscribing needs the browser's notification permission; a device that already
 * allowed ORA notifications (the bell asks on first open) is subscribed quietly, no extra tap.
 *
 *   checking     still finding out
 *   unsupported  this browser can't do push (the bell keeps its slow check)
 *   ios-install  iPhone/iPad in Safari: push only works from the Home Screen app
 *   unavailable  the server isn't set up for push yet (keys / table), so nothing is offered
 *   off          can be turned on
 *   on           this device gets pop-ups
 *   blocked      the browser has notifications blocked for ORA
 */
export type PushState = "checking" | "unsupported" | "ios-install" | "unavailable" | "off" | "on" | "blocked";

const LS_KEY = "ora.push.v1"; // { endpoint, uid, at }: what we last told the server about this device
const RESEND_MS = 7 * 24 * 60 * 60 * 1000;

function keyBytes(b64url: string) {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

type Server = { enabled: boolean; publicKey?: string; uid?: string };

export function usePushAlerts() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const server = useRef<Server | null>(null);

  const tellServer = useCallback(async (sub: PushSubscription, uid: string | undefined, force: boolean) => {
    let last: { endpoint?: string; uid?: string; at?: number } = {};
    try {
      last = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      /* ignore */
    }
    // Only write to the server when something changed (new device address, a different person signed in, or a weekly refresh).
    if (!force && last.endpoint === sub.endpoint && last.uid === uid && Date.now() - (last.at ?? 0) < RESEND_MS) return true;
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return false;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ endpoint: sub.endpoint, uid, at: Date.now() }));
    } catch {
      /* ignore */
    }
    return true;
  }, []);

  const refresh = useCallback(async () => {
    try {
      if (typeof window === "undefined") return;
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      if (!server.current) {
        const res = await fetch("/api/push", { cache: "no-store" });
        if (res.status === 401) return; // not signed in: stay quiet
        server.current = res.ok ? ((await res.json()) as Server) : { enabled: false };
      }
      const srv = server.current;
      if (!srv.enabled || !srv.publicKey) return setState("unavailable");
      if (Notification.permission === "denied") return setState("blocked");
      if (Notification.permission !== "granted") return setState("off");
      // Permission already given: make sure this device is subscribed (quietly) and known to the server.
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(srv.publicKey) });
      setState((await tellServer(sub, srv.uid, false)) ? "on" : "off");
    } catch {
      setState("off");
    }
  }, [tellServer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const srv = server.current;
      if (!srv?.enabled || !srv.publicKey) return setState("unavailable");
      const perm = await Notification.requestPermission();
      if (perm === "denied") return setState("blocked");
      if (perm !== "granted") return setState("off");
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(srv.publicKey) }));
      if (await tellServer(sub, srv.uid, true)) setState("on");
      else {
        setState("off");
        setError("Could not turn alerts on. Please try again.");
      }
    } catch {
      setState("off");
      setError("Could not turn alerts on on this device.");
    } finally {
      setBusy(false);
    }
  }, [tellServer]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      try {
        localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }
      setState("off");
    } catch {
      setError("Could not turn alerts off.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable, refresh };
}

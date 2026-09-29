"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BellOff,
  Volume2,
  CheckCheck,
  Package,
  Wallet,
  Receipt,
  FileText,
  ArrowLeftRight,
  Undo2,
  ShoppingCart,
  CreditCard,
  Send,
  type LucideIcon,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn, timeAgo } from "@/lib/utils";
import { playSound, unlockAudio, useAudioReady } from "@/components/app/notification-sound";
import type { NotifDTO, NotifPulse } from "@/lib/notifications/types";

const POLL_MS = 20_000; // how often we ask "anything new?"
const REPEAT_MS = 25_000; // how often an unresolved ACTION re-rings
const LS_KEY = "ora.notif.v1";

type Settings = { enabled: boolean; volume: number };
const DEFAULTS: Settings = { enabled: true, volume: 70 };

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

/** Icon + tone per notification type (buckets by machine-code prefix). */
function kindOf(type: string): { icon: LucideIcon; tone: string } {
  const t = (type || "").toUpperCase();
  if (t.startsWith("STOCK")) return { icon: Package, tone: "bg-primary/12 text-primary" };
  if (t.startsWith("TRANSFER")) return { icon: ArrowLeftRight, tone: "bg-info/15 text-info" };
  if (t.startsWith("RETURN")) return { icon: Undo2, tone: "bg-warning/15 text-warning" };
  if (t.startsWith("EXPENSE") || t.startsWith("FUND")) return { icon: Receipt, tone: "bg-warning/15 text-warning" };
  if (t.startsWith("CREDIT")) return { icon: CreditCard, tone: "bg-info/15 text-info" };
  if (t.startsWith("REPORT")) return { icon: FileText, tone: "bg-muted text-muted-foreground" };
  if (t.startsWith("ORDER_DISPATCH")) return { icon: Send, tone: "bg-primary/12 text-primary" };
  if (t.startsWith("ORDER")) return { icon: ShoppingCart, tone: "bg-info/15 text-info" };
  if (t.startsWith("SETTLEMENT") || t.startsWith("SALE") || t.startsWith("COLLECTION"))
    return { icon: Wallet, tone: "bg-success/12 text-success" };
  return { icon: Bell, tone: "bg-muted text-muted-foreground" };
}

/**
 * THE BELL — mounted once in the shared top bar, so it shows on every role's
 * dashboard. It polls the role-scoped /api/notifications, rings once when
 * something new arrives (twice, and pops a toast), and RE-RINGS every ~25s while
 * any ACTION item is still unresolved — the sound stops on its own when the
 * workflow action completes (the item leaves the waiting set). Tap the bell to
 * open the center; the speaker button switches sound on/off (persisted per user).
 */
export function NotificationBell() {
  const router = useRouter();
  const audio = useAudioReady();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifDTO[]>([]);
  const [waiting, setWaiting] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const seen = useRef<Set<string> | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => setSettings(loadSettings()), []);
  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  // Browsers block audio until a gesture — the first tap/keypress unlocks it.
  useEffect(() => {
    if (audio) return;
    const unlock = () => void unlockAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [audio]);

  // Poll for this user's notifications; ring + toast on anything new.
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      // Poll even when the tab is hidden — that's exactly when a background OS
      // notification matters. Sound is naturally suppressed while hidden (the
      // audio context is suspended), so a hidden tab alerts via the OS popup only.
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (res.status === 401) return; // signed out / no session — stay quiet
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as NotifPulse;
        if (stop) return;
        setOnline(true);
        setItems(data.items);
        setWaiting(data.waitingIds);
        setUnread(data.unread);
        const ids = data.items.map((i) => i.id);
        if (seen.current === null) {
          seen.current = new Set(ids); // first load: don't ring for the backlog
          return;
        }
        const arrived = data.items.filter((i) => !seen.current!.has(i.id));
        ids.forEach((id) => seen.current!.add(id));
        if (!arrived.length) return;
        const s = settingsRef.current;
        const hasAction = arrived.some((a) => a.category === "ACTION");
        if (s.enabled) playSound(hasAction ? "bell" : "chime", s.volume, 2);
        for (const a of arrived.slice(0, 3)) toast({ title: a.title, description: a.body });
        if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(arrived[0].title, { body: arrived.map((a) => a.body).join("\n"), tag: "ora-notif" });
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!stop) setOnline(false);
      }
    };
    void tick();
    const t = setInterval(tick, POLL_MS);
    const onShow = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, []);

  // Still waiting on an action: re-ring until it's resolved (or muted).
  const waitKey = waiting.join(",");
  useEffect(() => {
    if (!waitKey || !settings.enabled) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") playSound("bell", settingsRef.current.volume, 1);
    }, REPEAT_MS);
    return () => clearInterval(t);
  }, [waitKey, settings.enabled]);

  const markAllRead = useCallback(async (flipLocal: boolean) => {
    setUnread(0);
    if (flipLocal) setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readAll" }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const openPanel = () => {
    setOpen((v) => !v);
    if (!open) {
      if (unread > 0) void markAllRead(false); // clear badge; keep "new" highlight until next poll
      // Ask for OS-notification permission on explicit intent (opening the bell),
      // so alerts can reach the user when the tab is in the background.
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try {
          void Notification.requestPermission();
        } catch {
          /* ignore */
        }
      }
    }
  };

  const onItem = async (n: NotifDTO) => {
    setOpen(false);
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id: n.id }),
      });
    } catch {
      /* ignore */
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };

  const toggleSound = () => {
    const s = { ...settings, enabled: !settings.enabled };
    saveSettings(s);
    if (s.enabled) void unlockAudio().then((ok) => ok && playSound("chime", s.volume, 1));
  };

  const soundOn = settings.enabled;
  const live = online && audio && soundOn;
  const waitingCount = waiting.length;
  const Icon = !soundOn ? BellOff : waitingCount > 0 ? BellRing : Bell;
  const status = !online
    ? "Offline — reconnecting…"
    : !soundOn
      ? "Sound is off"
      : audio
        ? "Live · sound on"
        : "Tap anywhere to turn on sound";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-label={`Notifications${waitingCount ? ` · ${waitingCount} need action` : ""}${unread ? ` · ${unread} unread` : ""}`}
        title={status}
        className="relative grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Icon className={cn("size-4", waitingCount > 0 && soundOn && "text-foreground")} />
        <StatusDot on={live} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-glow"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Notifications</p>
                <p className="truncate text-xs text-muted-foreground">{status}</p>
              </div>
              <button
                type="button"
                onClick={toggleSound}
                title={soundOn ? "Turn sound off" : "Turn sound on"}
                aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                  soundOn ? "border-border hover:bg-muted" : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {soundOn ? <Volume2 className="size-4" /> : <BellOff className="size-4" />}
              </button>
            </div>

            {items.some((i) => !i.read) && (
              <button
                type="button"
                onClick={() => markAllRead(true)}
                className="flex w-full items-center gap-1.5 border-b border-border/60 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}

            {items.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-xs text-muted-foreground">
                Nothing yet — alerts for you appear here.
              </p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-border/50 overflow-y-auto">
                {items.map((n) => {
                  const k = kindOf(n.type);
                  const needsAction = n.category === "ACTION" && !n.resolved;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => onItem(n)}
                        className={cn(
                          "flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60",
                          !n.read && "bg-primary/[0.04]",
                        )}
                      >
                        <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", k.tone)}>
                          <k.icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold">{n.title}</span>
                            {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{n.body}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{timeAgo(n.createdAt)}</span>
                            {needsAction && n.actionLabel && (
                              <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">
                                {n.actionLabel}
                              </span>
                            )}
                            {n.category === "ACTION" && n.resolved && <span className="text-success">Done</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Green: live with sound. Red: sound off, blocked or offline. */
function StatusDot({ on }: { on: boolean }) {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-card">
      {on && <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-60" />}
      <span className={cn("relative inline-flex size-2 rounded-full", on ? "bg-emerald-400" : "bg-rose-500")} />
    </span>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, Download, EllipsisVertical, Menu, Share, SquarePlus, TriangleAlert, X } from "lucide-react";
import { detectDevice, type Device } from "@/lib/device";

/**
 * Use it as an app. A website in a browser tab always keeps the browser's own bars and no page can hide
 * them; the only full-screen version is the one put on the home screen. So a phone that has not done that
 * gets a small sheet saying how — ONE TAP on Android (Chrome's own Install button), a few steps on an
 * iPhone, Samsung or Huawei, and a clear warning when the page is open inside WhatsApp or another app
 * (which cannot add anything to the home screen). It opens by itself once — on the sign-in page, or after
 * sign-in — and any time from "Get the full-screen app" on the sign-in page and "Get the app" in the
 * person's menu. Nothing shows once the app is installed. (Same as Super Drive OS and Target Express.)
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Android / Chrome fires this once, early; kept here so any part of the page can use it later.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}

const SEEN = "ora.installSeen";

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useInstall() {
  const [state, setState] = useState<{ ready: boolean; phone: boolean; installed: boolean; device: Device; canPrompt: boolean }>({
    ready: false,
    phone: false,
    installed: false,
    device: { os: "other", browser: "other", inApp: false },
    canPrompt: false,
  });
  useEffect(() => {
    const check = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const phone = window.matchMedia("(max-width: 1023px)").matches && window.matchMedia("(pointer: coarse)").matches;
      const device = detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
      setState({ ready: true, phone, installed: standalone, device, canPrompt: !!deferred });
    };
    check();
    listeners.add(check);
    return () => void listeners.delete(check);
  }, []);
  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    listeners.forEach((f) => f());
    return outcome === "accepted";
  }, []);
  return { ...state, install };
}

type StepDef = { text: React.ReactNode; icon?: typeof Share };

/** The steps for this phone and browser, as short as they can be (owner, 2026-11-09: "small and nice, not big"). */
function stepsFor(d: Device): StepDef[] {
  const open: StepDef = {
    text: (
      <>
        Open <b>ORA</b> from your home screen
      </>
    ),
  };
  if (d.os === "ios") {
    return [
      {
        icon: Share,
        text:
          d.browser === "safari" || d.inApp ? (
            <>
              Tap <b>Share</b> (bottom bar, or <b>···</b>)
            </>
          ) : (
            <>
              Tap <b>Share</b> by the address bar
            </>
          ),
      },
      {
        icon: SquarePlus,
        text: (
          <>
            Tap <b>Add to Home Screen</b>
          </>
        ),
      },
      {
        text: (
          <>
            Tap <b>Add</b>, then open <b>ORA</b>
          </>
        ),
      },
    ];
  }
  switch (d.browser) {
    case "samsung":
      return [
        { icon: Menu, text: <>Tap the menu, bottom right</> },
        {
          text: (
            <>
              <b>Add page to</b> → <b>Home screen</b> (or <b>Install app</b>)
            </>
          ),
        },
        open,
      ];
    case "huawei":
      return [
        { icon: Menu, text: <>Open the browser menu</> },
        {
          text: (
            <>
              <b>Add to home screen</b> (or <b>Add to desktop</b>)
            </>
          ),
        },
        open,
      ];
    case "firefox":
      return [
        { icon: EllipsisVertical, text: <>Open the menu, top right</> },
        {
          text: (
            <>
              <b>Install</b> → <b>Add</b>
            </>
          ),
        },
        open,
      ];
    default:
      return [
        { icon: EllipsisVertical, text: <>Open the browser menu (⋮)</> },
        {
          text: (
            <>
              <b>Install app</b> or <b>Add to Home screen</b>
            </>
          ),
        },
        open,
      ];
  }
}

/**
 * A small card at the foot of the screen, close to the browser's own Share/menu button — not a big dialog. It matches
 * the scene behind it (dark plum glass, white text, hairlines), like the ZELab one the owner held up (2026-11-09):
 * a one-line title, three short steps, a cross to close; on an iPhone in Safari a small "Share ↓" points at the
 * Share button in the bottom bar. On Android with Chrome's own install offer it is one button. Escape closes it.
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { device, canPrompt, install } = useInstall();
  const browserName = device.os === "ios" ? "Safari" : "Chrome";
  const oneTap = canPrompt && !device.inApp;
  const pointAtShare = !oneTap && device.os === "ios" && device.browser === "safari" && !device.inApp;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // the page's own foot lines (marked .install-hide) step aside while the card sits there
    document.documentElement.dataset.installOpen = "1";
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.installOpen;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center px-4 ${
        pointAtShare ? "pb-[calc(var(--sab,0px)+0.25rem)]" : "pb-[calc(var(--sab,0px)+0.75rem)]"
      }`}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Use it like an app"
        className="ora-rise pointer-events-auto w-full max-w-[21rem] rounded-2xl border border-white/10 bg-[#1b0d24]/80 px-5 pb-2 pt-4 text-left text-white shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[16px] font-medium leading-tight">Use it like an app</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-8 shrink-0 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {device.inApp && (
          <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-white/80">
            <TriangleAlert className="mt-px size-4 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
            <span>
              Inside {device.appName} this can&apos;t be added. Tap <b className="font-medium text-white">···</b> and choose{" "}
              <b className="font-medium text-white">Open in {browserName}</b> first.
            </span>
          </p>
        )}

        {oneTap ? (
          <div className="mb-2 mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (await install()) onClose();
              }}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
            >
              <Download className="size-4" strokeWidth={1.5} aria-hidden="true" />
              Install
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full px-4 text-[14px] text-white/60 transition-colors hover:text-white"
            >
              Not now
            </button>
          </div>
        ) : (
          <ol className="mt-1 divide-y divide-white/10 [&_b]:font-medium [&_b]:text-white">
            {stepsFor(device).map((st, i) => (
              <li key={i} className="flex min-h-10 items-center gap-3 py-1.5 text-[14px] leading-snug text-white/75">
                <span className="w-3 shrink-0 text-center text-[13px] tabular-nums text-[hsl(322_100%_72%)]">{i + 1}</span>
                <span className="min-w-0 flex-1">{st.text}</span>
                {st.icon && <st.icon className="size-4 shrink-0 text-white/50" strokeWidth={1.5} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        )}
      </div>

      {pointAtShare && (
        <p className="ora-rise ora-rise-2 mt-2 flex flex-col items-center text-[12px] text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]" aria-hidden="true">
          Share
          <ArrowDown className="mt-0.5 size-4 text-[hsl(322_100%_72%)]" strokeWidth={1.5} />
        </p>
      )}
    </div>
  );
}

/** Opens by itself once, a moment after a phone's browser opens the app (not when it is already installed); "Not now" or closing it is remembered. */
export function InstallPrompt() {
  const { ready, phone, installed } = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready || !phone || installed || read(SEEN)) return;
    const t = window.setTimeout(() => setOpen(true), 2500);
    return () => window.clearTimeout(t);
  }, [ready, phone, installed]);
  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN, "1");
    } catch {
      /* private window: it simply asks again next time */
    }
  };
  return <InstallSheet open={open} onClose={close} />;
}

/** A button that opens the sheet. Draws nothing on a computer or once the app is installed. `render` lets the caller style it. */
export function InstallButton({ render }: { render: (open: () => void) => React.ReactNode }) {
  const { ready, phone, installed } = useInstall();
  const [open, setOpen] = useState(false);
  if (!ready || !phone || installed) return null;
  return (
    <>
      {render(() => setOpen(true))}
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

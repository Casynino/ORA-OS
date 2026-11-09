"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, EllipsisVertical, Menu, Share, Smartphone, SquarePlus, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

/** The steps for this phone and browser. Every browser words them a little differently, so each gets its own. */
function stepsFor(d: Device): StepDef[] {
  const open: StepDef = {
    text: (
      <>
        Open <b>ORA</b> from your home screen.
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
              Tap <b>Share</b> at the bottom of Safari (on newer iPhones it is under the <b>···</b> button).
            </>
          ) : (
            <>
              Tap <b>Share</b> next to the address at the top.
            </>
          ),
      },
      {
        icon: SquarePlus,
        text: (
          <>
            Scroll down and tap <b>Add to Home Screen</b>.
          </>
        ),
      },
      {
        text: (
          <>
            Tap <b>Add</b>, then open <b>ORA</b> from your home screen.
          </>
        ),
      },
    ];
  }
  switch (d.browser) {
    case "samsung":
      return [
        { icon: Menu, text: <>Tap the menu at the bottom right.</> },
        {
          text: (
            <>
              Tap <b>Add page to</b>, then <b>Home screen</b> (or <b>Install app</b> if you see it).
            </>
          ),
        },
        open,
      ];
    case "huawei":
      return [
        { icon: Menu, text: <>Open the browser menu (at the bottom, or the three dots at the top right).</> },
        {
          text: (
            <>
              Tap <b>Add to home screen</b> (some phones say <b>Add to desktop</b> or hide it under <b>Add to</b>), then confirm.
            </>
          ),
        },
        open,
      ];
    case "firefox":
      return [
        { icon: EllipsisVertical, text: <>Open the browser menu at the top right.</> },
        {
          text: (
            <>
              Tap <b>Install</b>, then <b>Add</b>.
            </>
          ),
        },
        open,
      ];
    default:
      return [
        { icon: EllipsisVertical, text: <>Open the browser menu (the three dots, top right or bottom).</> },
        {
          text: (
            <>
              Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.
            </>
          ),
        },
        open,
      ];
  }
}

export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { device, canPrompt, install } = useInstall();
  const browserName = device.os === "ios" ? "Safari" : "Chrome";
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-sm rounded-2xl"
      title={
        <span className="flex items-center gap-3 pr-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0b0014] text-white">
            <Smartphone className="size-5" />
          </span>
          <span className="block">
            <span className="block text-base font-semibold leading-tight">Use it like an app</span>
            <span className="mt-0.5 block text-[13px] font-normal leading-snug text-muted-foreground">
              Full screen, no browser bar, its own icon.
            </span>
          </span>
        </span>
      }
    >
      {device.inApp && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px] leading-snug">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
          <span>
            This page is open inside {device.appName}, which cannot put it on the home screen. Tap the <b>···</b> (or three dots) at the top and
            choose <b>Open in {browserName}</b> or <b>Open in browser</b>, then do these steps.
          </span>
        </div>
      )}

      {canPrompt && !device.inApp ? (
        <div className="flex flex-col gap-2">
          <Button
            onClick={async () => {
              if (await install()) onClose();
            }}
          >
            <Download className="size-4" />
            Install the app
          </Button>
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {stepsFor(device).map((st, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-[13px] leading-snug">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{st.text}</span>
                {st.icon && <st.icon className="size-4 shrink-0 text-muted-foreground" />}
              </li>
            ))}
          </ol>
          <Button variant="outline" className="mt-4 w-full" onClick={onClose}>
            Got it
          </Button>
        </>
      )}
    </Modal>
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

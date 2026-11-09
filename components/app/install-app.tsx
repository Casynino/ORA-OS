"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, EllipsisVertical, Menu, Share, Smartphone, SquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Use it as an app. A website in a browser tab always keeps the browser's own bars and no
 * page can hide them; the only full-screen version is the one put on the home screen. So a
 * phone that has not done that gets a small sheet saying how — one tap on Android Chrome,
 * a few steps on an iPhone, Samsung or Huawei. It opens by itself once after a phone first
 * signs in, and any time from the sign-in page. Nothing shows once the app is installed.
 * (Same idea as the Target Express and Super Drive systems.)
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Chrome on Android fires this once, early; kept here so any part of the page can use it later.
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

/**
 * Which phone browser this is, because the way to the home screen differs: Safari's Share
 * sheet, Chrome's ⋮ menu, Samsung Internet's and Huawei's ☰ menu at the bottom, and the
 * browser inside WhatsApp / Facebook / Instagram, which cannot add anything to the home
 * screen at all (links shared on WhatsApp open there).
 */
type Browser = "safari" | "ios-other" | "chrome" | "samsung" | "huawei" | "android-other" | "in-app";

function browserOf(ua: string, ios: boolean): Browser {
  if (/MicroMessenger|WhatsApp|FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly/i.test(ua)) return "in-app";
  // An iPhone page view that is not Safari, Chrome, Firefox or Edge is an app's own browser;
  // an Android WebView says "wv".
  if (ios && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "in-app";
  if (!ios && /; wv\)/i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "safari";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/HuaweiBrowser|HBPC|HarmonyOS|OpenHarmony|ArkWeb/i.test(ua)) return "huawei";
  if (/Chrome\//i.test(ua) && !/EdgA|OPR|Firefox|YaBrowser|UCBrowser|MiuiBrowser|HeyTapBrowser/i.test(ua)) return "chrome";
  return "android-other";
}

function useInstall() {
  const [state, setState] = useState({
    ready: false,
    phone: false,
    installed: false,
    ios: false,
    browser: "chrome" as Browser,
    canPrompt: false,
  });
  useEffect(() => {
    const check = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const phone = window.matchMedia("(max-width: 1023px)").matches && window.matchMedia("(pointer: coarse)").matches;
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setState({ ready: true, phone, installed: standalone, ios, browser: browserOf(navigator.userAgent, ios), canPrompt: !!deferred });
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

function Step({ n, icon: Icon, children }: { n: number; icon?: typeof Share; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-[13px] leading-snug">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
    </li>
  );
}

function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ios, browser, canPrompt, install } = useInstall();
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
      {canPrompt ? (
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
            {browser === "in-app" ? (
              <>
                <Step n={1} icon={EllipsisVertical}>
                  Tap the menu (⋯ or ⋮), then Open in browser.
                </Step>
                <Step n={2}>
                  {ios
                    ? "In Safari, sign in and tap Get the full-screen app again."
                    : "In Chrome, sign in and tap Get the full-screen app again."}
                </Step>
              </>
            ) : ios ? (
              <>
                <Step n={1} icon={Share}>
                  {browser === "safari" ? "Tap Share at the bottom of Safari." : "Tap Share in the address bar or the menu."}
                </Step>
                <Step n={2} icon={SquarePlus}>
                  Scroll down and tap Add to Home Screen.
                </Step>
                <Step n={3}>Tap Add, then open ORA from your home screen.</Step>
              </>
            ) : browser === "samsung" ? (
              <>
                <Step n={1} icon={Menu}>
                  Tap the menu at the bottom right.
                </Step>
                <Step n={2}>Tap Add page to, then Home screen.</Step>
                <Step n={3}>Open ORA from your home screen.</Step>
              </>
            ) : browser === "huawei" ? (
              <>
                <Step n={1} icon={Menu}>
                  Tap the menu at the bottom of the browser.
                </Step>
                <Step n={2}>Tap Add to home screen (it may be under Add to).</Step>
                <Step n={3}>Open ORA from your home screen.</Step>
              </>
            ) : (
              <>
                <Step n={1} icon={browser === "chrome" ? EllipsisVertical : Menu}>
                  {browser === "chrome" ? "Open the browser menu at the top right." : "Open the browser menu."}
                </Step>
                <Step n={2}>Tap Install app or Add to Home screen.</Step>
                <Step n={3}>Open ORA from your home screen.</Step>
              </>
            )}
          </ol>
          {browser !== "in-app" ? (
            <p className="mt-3 text-[12px] text-muted-foreground">
              {ios
                ? "If this page opened inside WhatsApp or another app, open it in Safari first."
                : "If this page opened inside WhatsApp or another app, open it in Chrome first."}
            </p>
          ) : null}
          <Button variant="outline" className="mt-4 w-full" onClick={onClose}>
            Got it
          </Button>
        </>
      )}
    </Modal>
  );
}

/** Opens by itself once, a moment after a phone's browser opens the app (never when it is installed); closing it is remembered. */
export function InstallPrompt() {
  const { ready, phone, installed } = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!ready || !phone || installed) return;
    try {
      if (window.localStorage.getItem(SEEN)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 2500);
    return () => window.clearTimeout(timer);
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

/** A button that opens the sheet. Draws nothing on a computer or once the app is installed. */
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

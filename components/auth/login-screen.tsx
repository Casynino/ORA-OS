"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Smartphone, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { InstallButton, InstallPrompt } from "@/components/app/install-app";
import { formatNumber } from "@/lib/utils";

// Real ORA outreach photos, cross-fading slowly behind the brand overlay.
const SLIDES = [
  { src: "/ora/gallery/g2.jpg", alt: "An ORA ambassador speaking to schoolgirls" },
  { src: "/ora/event/e05.jpg", alt: "An ORA outreach event in Tanzania" },
  { src: "/ora/gallery/g3.jpg", alt: "Girls and pads at an ORA event" },
];

/**
 * The sign-in screen: a full-screen scene (real photos, the ORA mark, one line and a big
 * "Log in" button). Pressing it opens the sign-in as a pop-up — a sheet from the bottom on a
 * phone, a centred card on a bigger screen — while the scene stays visible, softly blurred,
 * behind it. The form itself (and the sign-in action) is the same `LoginForm` as before.
 */
export function LoginScreen({
  pads,
  communities,
  autoOpen = false,
}: {
  pads: number;
  communities: number;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <main data-login-scene className="relative flex min-h-scene flex-col bg-[#0b0014] text-white">
      {/* ── The scene ───────────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {SLIDES.map((s, i) => (
          <div key={s.src} className="login-slide absolute inset-0 opacity-0" style={{ animationDelay: `${i * 6}s` }}>
            <Image src={s.src} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
          </div>
        ))}
        {/* Brand colour wash + a dark base so text always reads */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0014]/80 via-[#0b0014]/50 to-[#0b0014]/95" />
        <div className="absolute -left-24 -top-24 size-[26rem] rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute -bottom-32 -right-20 size-[30rem] rounded-full bg-accent/30 blur-[130px]" />
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pb-[max(1.25rem,var(--sab))] pt-[calc(var(--sat)+1rem)] text-center">
        {/* No browser bar in the home-screen app, so there is always a way back. */}
        <Link
          href="/"
          className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 text-[13px] text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to site
        </Link>
        <Link href="/" aria-label="ORA-Pads home" className="mt-3 sm:mt-6">
          <Logo mark="light" priority className="h-28 sm:h-36 [@media(max-height:560px)]:h-16 [@media(max-height:560px)]:sm:h-16" />
        </Link>
        <span className="mt-4 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm [@media(max-height:480px)]:hidden">
          The ORA Movement · Tanzania
        </span>

        <div className="min-h-6 flex-1" />

        <div className="w-full max-w-md pb-2">
          <h1 className="font-display text-[2rem] font-bold leading-[1.1] sm:text-4xl [@media(max-height:480px)]:text-2xl">
            Put a pad in <span className="text-gradient">every girl&apos;s hand.</span>
          </h1>
          <p className="mt-3 text-[15px] text-white/80 [@media(max-height:480px)]:hidden">Orders, stock, sales and credit in one place.</p>

          <button
            ref={trigger}
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="mx-auto mt-7 [@media(max-height:480px)]:mt-3 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-10 text-base font-semibold text-white shadow-glow ring-1 ring-white/20 transition-transform active:scale-[0.98]"
          >
            Log in <ArrowRight className="size-5" />
          </button>

          <p className="mt-4 text-sm text-white/70">
            New here?{" "}
            <Link href="/request-access" className="font-medium text-white underline-offset-4 hover:underline">
              Request access
            </Link>
          </p>

          {/* A browser tab always keeps the browser's bars; the home-screen app is full screen.
              Only phones that haven't installed it see this. */}
          <InstallButton
            render={(openSheet) => (
              <button
                type="button"
                onClick={openSheet}
                className="mx-auto mt-4 inline-flex items-center gap-1.5 text-[13px] text-white/65 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                <Smartphone className="size-3.5" />
                Get the full-screen app
              </button>
            )}
          />
        </div>

        <p className="mt-6 text-[11px] text-white/55 [@media(max-height:480px)]:hidden">
          {formatNumber(pads)}+ pads delivered · {formatNumber(communities)} communities reached
        </p>
        <p className="mt-1 text-[11px] text-white/40 [@media(max-height:480px)]:hidden">© {new Date().getFullYear()} ORA-Pads · Period dignity for all</p>

        {/* Who made the system — one quiet line to Nino's page and work (only here, on the sign-in page). Plain text, no
            pill or badge around it (owner, 2026-11-09: "clean, like before"); Nino turns ORA pink on hover. */}
        <Link
          href="/nino"
          className="group mt-1 inline-flex min-h-10 items-center gap-1 rounded-sm text-xs text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          Developed by <span className="font-semibold text-white/80 transition-colors group-hover:text-primary">Nino</span>
          <ArrowUpRight
            className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* A phone that has not installed ORA is offered the full-screen app once, right here on arrival
          (never on top of the sign-in pop-up). */}
      {!open && <InstallPrompt />}

      {open && (
        <SignInSheet
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </main>
  );
}

/** The pop-up. Esc, the X and a tap on the blurred scene all close it. */
function SignInSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  // How much of the bottom of the screen the phone keyboard covers, so the sheet sits above it.
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // A mouse user can start typing at once; on a touch screen don't pop the keyboard up unasked.
    if (window.matchMedia("(pointer: fine)").matches) document.getElementById("email")?.focus();
    else sheet.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(
      sheet.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])'),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      style={{ paddingBottom: kb || undefined }}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close sign in"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[6px]"
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        tabIndex={-1}
        style={{ "--kb": `${kb}px` } as React.CSSProperties}
        className="sheet-max relative w-full max-w-md animate-slide-up overflow-y-auto rounded-t-3xl border border-border bg-card px-6 pb-[max(1.5rem,var(--sab))] pt-3 text-card-foreground shadow-2xl outline-none sm:rounded-3xl sm:pb-6 sm:pt-6"
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
        >
          <X className="size-5" />
        </button>

        <h2 id="signin-title" className="font-display text-2xl font-bold tracking-tight">
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your ORA-Pads account.</p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

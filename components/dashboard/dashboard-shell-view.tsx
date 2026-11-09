"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, Globe, LayoutDashboard, Menu } from "lucide-react";
import { NotificationBell } from "@/components/app/notification-bell";
import { ActingBanner, useActing } from "@/components/developer/acting-banner";
import { InstallPrompt } from "@/components/app/install-app";
import { GlassSidebar } from "@/components/dashboard/glass-sidebar";
import { ICONS, type NavGroup, type NavItem } from "@/components/dashboard/nav-data";
import { SIDEBAR_COOKIE, SIDEBAR_ROOM } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

export type { NavGroup, NavItem };

/** Today on ORA's calendar (Tanzania), short — the phone's top bar shows it on a department's home. */
const dateShort = () =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Dar_es_Salaam" }).format(new Date());

/**
 * Is this a computer-size screen (the same break as Tailwind's `lg`)? `null` until the page has
 * loaded. The notification bell polls and plays a sound, so exactly ONE bell may exist at a time:
 * the phone's top bar and the computer's top bar each draw theirs only when they are the one showing
 * (hiding the other with CSS would still leave it running, and every alert would sound twice).
 */
function useIsDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

export function DashboardShellView({
  nav,
  user,
  areaLabel,
  profileHref,
  mobileTabs,
  sidebarCollapsed = false,
  children,
}: {
  nav: NavGroup[];
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    avatar?: string | null;
    preferredName?: string | null;
  };
  /** Small line under the name at the top of the sidebar. Leave out for none. */
  areaLabel?: string;
  profileHref?: string;
  /** Phones get an app-style bottom bar: these pages (hrefs from `nav`, up to 4) plus a
   *  "Menu" button that opens the full menu. Leave out for no bottom bar. */
  mobileTabs?: string[];
  /** Read from a cookie on the server, so a folded sidebar is folded on the first paint. */
  sidebarCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const acting = useActing();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const homeHref = nav[0]?.items[0]?.href ?? "/";
  const allItems = nav.flatMap((g) => g.items);
  const tabs = (mobileTabs ?? [])
    .map((h) => allItems.find((i) => i.href === h))
    .filter((i): i is NavItem => !!i)
    .slice(0, 4);
  const hasTabs = tabs.length > 0;
  // A tab is lit on its own page and on pages inside it (Home only on itself).
  const tabActive = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(href + "/"));
  const menuActive = hasTabs && !tabs.some((t) => tabActive(t.href));

  const fold = (next: boolean) => {
    setCollapsed(next);
    // A cookie, not localStorage: the server reads it, so a folded sidebar is folded on the first
    // paint instead of opening and snapping shut.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "rail" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  // The phone's top bar shows today's date on a department's home; written after load so the
  // server and the phone never disagree about what day it is.
  const [today, setToday] = useState("");
  useEffect(() => setToday(dateShort()), []);

  // While someone is typing, the phone keyboard needs the room: tuck the bar away (Android
  // browsers shrink the page for the keyboard and would otherwise leave the bar sitting on
  // top of the field). It slides back when the field loses focus.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!hasTabs) return;
    const FIELD =
      'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=file]):not([type=color]), textarea, select, [contenteditable=""], [contenteditable="true"]';
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && el.matches(FIELD);
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) setTyping(true);
    };
    const onOut = () => {
      setTimeout(() => setTyping(isField(document.activeElement)), 80);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, [hasTabs]);

  // Tell the page-level pieces outside the shell (toasts) that the bottom bar is there.
  useEffect(() => {
    if (!hasTabs) return;
    document.body.classList.add("has-app-shell");
    return () => document.body.classList.remove("has-app-shell");
  }, [hasTabs]);

  // Lock background scroll while the phone's drawer is open; close it on every page change.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Most-specific match wins: a link is active only if it's the LONGEST href the current path
  // matches. Without this a parent (e.g. /admin/finance) lights up on every child page at the
  // same time as the child itself. homeHref only ever matches exactly.
  const activeHref = allItems
    .map((i) => i.href)
    .filter((href) => pathname === href || (href !== homeHref && pathname.startsWith(href + "/")))
    .reduce((best, href) => (href.length > best.length ? href : best), "");

  // Back, on the phone: the real previous page when there is one (so a detail page unwinds the way
  // it was walked); on a fresh open (a WhatsApp link, the home-screen app) it climbs to the home.
  const onHome = pathname === homeHref;
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(homeHref);
  };

  return (
    <div className={cn("min-h-app bg-gradient-to-b from-secondary/40 via-background to-background", hasTabs && "app-shell")}>
      {/* Computer: the floating glass sidebar, which folds to a rail. */}
      <GlassSidebar
        mode="desktop"
        nav={nav}
        user={user}
        homeHref={homeHref}
        areaLabel={areaLabel}
        profileHref={profileHref}
        activeHref={activeHref}
        collapsed={collapsed}
        onCollapsedChange={fold}
      />

      {/* Phone: the same glass panel, as a drawer. */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(17rem,84vw)] animate-slide-in-left pb-[calc(0.75rem+var(--sab))] pl-3 pt-[calc(0.75rem+var(--sat))]">
            <GlassSidebar
              mode="sheet"
              nav={nav}
              user={user}
              homeHref={homeHref}
              areaLabel={areaLabel}
              profileHref={profileHref}
              activeHref={activeHref}
              onNavigate={() => setOpen(false)}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}

      <div
        className="transition-[padding] duration-200 motion-reduce:transition-none lg:pl-[var(--sidebar-room)] print:pl-0"
        style={{ "--sidebar-room": collapsed ? SIDEBAR_ROOM.rail : SIDEBAR_ROOM.open } as React.CSSProperties}
      >
        {/* A Developer working as someone gets a small floating pill (Stop lives there). */}
        {acting && <ActingBanner state={acting} />}

        {/* PHONE: one floating rounded bar — the menu, the date (or the way back), the bell —
            with the page fading out under it as it scrolls. */}
        <div
          className="pointer-events-none sticky top-[var(--sat)] z-20 pb-3 pt-3 lg:hidden print:hidden"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)) 60%, transparent)" }}
        >
          <div className="px-4 sm:px-6">
            <header className="pointer-events-auto flex h-14 items-center justify-between gap-2 rounded-2xl border border-border bg-card/95 pl-1 pr-1.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-foreground/80 transition-colors hover:bg-muted"
                >
                  <Menu className="size-5" />
                </button>
                {onHome ? (
                  <span className="truncate pl-1 text-sm font-medium text-foreground/80" suppressHydrationWarning>
                    {today}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex h-10 min-w-0 items-center gap-0.5 rounded-xl pl-1 pr-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
                  >
                    <ChevronLeft className="size-5 shrink-0" />
                    Back
                  </button>
                )}
              </div>
              <div className="flex min-w-10 shrink-0 items-center justify-end gap-0.5">
                {desktop === false && <NotificationBell />}
              </div>
            </header>
          </div>
        </div>

        {/* COMPUTER: a slim bar — the way to the main site and the bell. (Night / day, the profile
            and Sign out are in the sidebar's bottom menu.) */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-end gap-2 bg-gradient-to-b from-background/90 to-transparent px-8 lg:flex print:hidden">
          <Link
            href="/"
            aria-label="Back to main site"
            title="Back to main site"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Globe className="size-4" />
            Main site
          </Link>
          {desktop === true && <NotificationBell />}
        </header>

        {/* While the "Working as" pill floats, leave room at the end of the page so it never
            covers the last row of content. */}
        <main
          className={cn(
            "px-4 pb-[calc(var(--app-bar,0px)+1.25rem)] pt-1 sm:px-6 lg:px-8 lg:pb-8 lg:pt-2",
            acting && "pb-[calc(var(--app-bar,0px)+6rem)] lg:pb-24",
          )}
        >
          {children}
        </main>
      </div>

      {/* On a phone that hasn't installed ORA, offer the full-screen app once (after sign-in). */}
      <InstallPrompt />

      {/* Phone app bar: the department's main pages + Menu (the full menu). */}
      {hasTabs && (
        <nav
          aria-label="Main"
          aria-hidden={typing || undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[var(--sab)] backdrop-blur transition-transform duration-200 lg:hidden print:hidden",
            typing && "pointer-events-none translate-y-full",
          )}
        >
          <ul className="grid h-14" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
            {tabs.map((t) => {
              const Icon = ICONS[t.icon] ?? LayoutDashboard;
              const active = tabActive(t.href);
              return (
                <li key={t.href} className="min-w-0">
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-full flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors max-[319px]:text-[9px] min-[360px]:px-1 min-[360px]:text-[11px]",
                      active ? "text-primary" : "text-muted-foreground active:text-foreground",
                    )}
                  >
                    {active && <span aria-hidden className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-b-full bg-primary" />}
                    <Icon className="size-[22px] shrink-0" />
                    <span className="max-w-full truncate">{t.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="min-w-0">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className={cn(
                  "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors max-[319px]:text-[9px] min-[360px]:px-1 min-[360px]:text-[11px]",
                  menuActive ? "text-primary" : "text-muted-foreground active:text-foreground",
                )}
              >
                {menuActive && <span aria-hidden className="absolute inset-x-0 top-0 mx-auto h-0.5 w-8 rounded-b-full bg-primary" />}
                <Menu className="size-[22px] shrink-0" />
                <span>Menu</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

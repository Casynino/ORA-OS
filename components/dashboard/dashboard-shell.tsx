"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Package,
  ClipboardList,
  ClipboardCheck,
  HeartHandshake,
  CreditCard,
  Undo2,
  Users,
  BookOpen,
  Activity,
  PlusCircle,
  CalendarHeart,
  Boxes,
  Warehouse,
  ArrowLeftRight,
  Factory,
  FileText,
  Banknote,
  Percent,
  TrendingUp,
  Contact,
  UserPlus,
  BarChart3,
  Shield,
  ScrollText,
  ShoppingCart,
  Ship,
  PackagePlus,
  Send,
  ImageIcon,
  Newspaper,
  MessageSquare,
  Receipt,
  Home,
  Gift,
  Target,
  MapPin,
  BadgeCheck,
  Wallet,
  ChevronDown,
  ChevronRight,
  UserRound,
  CalendarClock,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/app/notification-bell";
import { ActingBanner, useActing } from "@/components/developer/acting-banner";
import { logoutAction } from "@/lib/actions/auth";
import { cn, humanize } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventory: Package,
  catalogue: Boxes,
  requests: ClipboardList,
  approvals: ClipboardCheck,
  newRequest: PlusCircle,
  credit: CreditCard,
  returns: Undo2,
  users: Users,
  education: BookOpen,
  activity: Activity,
  tracker: CalendarHeart,
  products: Package,
  warehouses: Warehouse,
  transfers: ArrowLeftRight,
  suppliers: Factory,
  invoices: FileText,
  settlements: Banknote,
  commissions: Percent,
  profit: TrendingUp,
  customers: Contact,
  profile: Contact,
  applications: UserPlus,
  reports: BarChart3,
  roles: Shield,
  audit: ScrollText,
  sales: ShoppingCart,
  imports: Ship,
  receive: PackagePlus,
  dispatch: Send,
  activities: ImageIcon,
  news: Newspaper,
  messages: MessageSquare,
  payments: Receipt,
  samples: Gift,
  targets: Target,
  fieldReports: MapPin,
  reps: BadgeCheck,
  finance: Wallet,
  extensions: CalendarClock,
  impact: HeartHandshake,
};

export type NavItem = { href: string; label: string; icon: string };
/** `icon` is the group's own icon (only used when the menu is collapsible);
 *  without it the first item's icon is used. */
export type NavGroup = { label?: string; icon?: string; items: NavItem[] };

export function DashboardShell({
  nav,
  user,
  areaLabel,
  profileHref,
  collapsibleNav = true,
  mobileTabs,
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
  /** Small heading above the menu (and in the phone top bar). Leave out for none. */
  areaLabel?: string;
  profileHref?: string;
  /** Labelled menu groups open and close (the group you're in stays open; your
   *  choices are remembered on this device). On for every department; pass
   *  `false` to always show every group. */
  collapsibleNav?: boolean;
  /** Phones get an app-style bottom bar: these pages (hrefs from `nav`, up to 4) plus a
   *  "Menu" button that opens the full menu. Leave out for no bottom bar. */
  mobileTabs?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const acting = useActing();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const homeHref = nav[0]?.items[0]?.href ?? "/";
  const displayName = user.preferredName || user.name;
  const allItems = nav.flatMap((g) => g.items);
  const tabs = (mobileTabs ?? [])
    .map((h) => allItems.find((i) => i.href === h))
    .filter((i): i is NavItem => !!i)
    .slice(0, 4);
  const hasTabs = tabs.length > 0;
  // A tab is lit on its own page and on pages inside it (Home only on itself).
  const tabActive = (href: string) => pathname === href || (href !== homeHref && pathname.startsWith(href + "/"));
  const menuActive = hasTabs && !tabs.some((t) => tabActive(t.href));

  // Tell the page-level pieces outside the shell (toasts) that the bottom bar is there.
  useEffect(() => {
    if (!hasTabs) return;
    document.body.classList.add("has-app-shell");
    return () => document.body.classList.remove("has-app-shell");
  }, [hasTabs]);

  // Close the user menu on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close the drawer automatically on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Most-specific match wins: a link is active only if it's the LONGEST href the
  // current path matches. Without this a parent (e.g. /admin/finance) lights up
  // on every child page (e.g. /admin/finance/operational-fund) at the same time
  // as the child itself. homeHref only ever matches exactly, so the dashboard
  // link doesn't light on every page.
  const activeHref = nav
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => pathname === href || (href !== homeHref && pathname.startsWith(href + "/")))
    .reduce((best, href) => (href.length > best.length ? href : best), "");

  const isActive = (href: string) => href === activeHref && activeHref !== "";

  // ── Collapsible groups (only when `collapsibleNav`) ──────────────────────
  // A group with a label and 2+ pages opens/closes. The group you are in is
  // always open; the rest start closed and remember what you chose (this device).
  const groupKey = (g: NavGroup, gi: number) => g.label ?? `group-${gi}`;
  const isCollapsible = (g: NavGroup) => collapsibleNav && !!g.label && g.items.length > 1;
  const activeGroupKey =
    nav
      .map((g, gi) => ({ g, gi }))
      .find(({ g }) => isCollapsible(g) && g.items.some((i) => i.href === activeHref))
      ?.g.label ?? null;
  const storeKey = `ora-nav-open:${homeHref}`;
  const [openKeys, setOpenKeys] = useState<string[]>(() => (activeGroupKey ? [activeGroupKey] : []));

  // Restore what was open last time (once), keeping the current group open.
  useEffect(() => {
    if (!collapsibleNav) return;
    try {
      const raw = localStorage.getItem(storeKey);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved)) {
        const keep = saved.filter((k): k is string => typeof k === "string");
        setOpenKeys((prev) => Array.from(new Set([...keep, ...prev])));
      }
    } catch {
      /* storage blocked — the menu just starts at its default */
    }
  }, [collapsibleNav, storeKey]);

  // Moving to a page in another group opens that group.
  useEffect(() => {
    if (activeGroupKey) setOpenKeys((prev) => (prev.includes(activeGroupKey) ? prev : [...prev, activeGroupKey]));
  }, [activeGroupKey]);

  function toggleGroup(key: string) {
    const next = openKeys.includes(key) ? openKeys.filter((k) => k !== key) : [...openKeys, key];
    setOpenKeys(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const renderNavItem = (item: NavItem, onNavigate?: () => void) => {
    const Icon = ICONS[item.icon] ?? LayoutDashboard;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
          active
            ? "bg-primary/12 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="size-[15px] shrink-0" />
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    );
  };

  // Breathing room around the flat shortcuts (Home etc.) before / after the groups.
  const flatGap = (g: NavGroup, gi: number) =>
    !collapsibleNav ? undefined : gi === 0 ? "mb-2" : !g.label ? "mt-2" : undefined;

  // Called as a function (not a component) so the open/close animation isn't
  // reset every time the shell re-renders.
  const renderNav = (onNavigate?: () => void) => (
    <nav className={cn("flex flex-1 flex-col", collapsibleNav ? "gap-0.5" : "gap-4")}>
      {nav.map((group, gi) => {
        if (!isCollapsible(group)) {
          // Single-page groups in a collapsible menu are plain links (nothing to hide).
          if (collapsibleNav && group.items.length === 1) {
            return (
              <div key={groupKey(group, gi)} className={flatGap(group, gi)}>
                {renderNavItem(group.items[0], onNavigate)}
              </div>
            );
          }
          return (
            <div key={groupKey(group, gi)} className={flatGap(group, gi)}>
              {group.label && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">{group.items.map((item) => renderNavItem(item, onNavigate))}</div>
            </div>
          );
        }

        const key = groupKey(group, gi);
        const isOpen = openKeys.includes(key);
        const hasActive = group.items.some((i) => i.href === activeHref);
        const GroupIcon = ICONS[group.icon ?? group.items[0].icon] ?? LayoutDashboard;
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => toggleGroup(key)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-muted",
                hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GroupIcon className="size-[15px] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              {hasActive && !isOpen && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />}
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 motion-reduce:transition-none",
                  isOpen && "rotate-90",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none",
                isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="mb-1 ml-[1.05rem] mt-0.5 flex flex-col gap-px border-l border-border pl-2">
                  {group.items.map((item) => renderNavItem(item, onNavigate))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const UserCard = () => (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2.5 px-1 py-1" title={user.email ?? undefined}>
        <Avatar name={user.name} src={user.avatar} className="size-8" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.role ? humanize(user.role) : user.email}</p>
        </div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className={cn("min-h-dvh bg-gradient-to-b from-secondary/40 via-background to-background", hasTabs && "app-shell")}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href={homeHref}>
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin p-3">
          {areaLabel && (
            <p className="px-2.5 pb-2 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              {areaLabel}
            </p>
          )}
          {renderNav()}
        </div>
        <UserCard />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,82vw)] animate-slide-in-left flex-col bg-card shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-1 rounded-md p-2 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto p-3">
              {renderNav(() => setOpen(false))}
            </div>
            <UserCard />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64">
        {/* A Developer working as someone gets a small floating pill (Stop lives there). */}
        {acting && <ActingBanner state={acting} />}
        <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className={cn("-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden", hasTabs && "hidden")}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            {areaLabel && (
              <span className="font-display font-semibold lg:hidden">
                {areaLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              aria-label="Back to main site"
              title="Back to main site"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Home className="size-4" />
              <span className="hidden sm:inline">Main site</span>
            </Link>
            <NotificationBell />
            <ThemeToggle />

            {/* User menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
              >
                <Avatar name={user.name} src={user.avatar} className="size-8" />
                <span className="hidden max-w-36 truncate text-sm font-medium md:inline">
                  {displayName}
                </span>
                <ChevronDown
                  className={cn(
                    "hidden size-3.5 text-muted-foreground transition-transform md:block",
                    menuOpen && "rotate-180",
                  )}
                />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-card shadow-glow"
                  >
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div className="p-1.5">
                      {profileHref && (
                        <>
                          <Link
                            href={profileHref}
                            role="menuitem"
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <UserRound className="size-4" />
                            My profile
                          </Link>
                          <Link
                            href={`${profileHref}#security`}
                            role="menuitem"
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Shield className="size-4" />
                            Security
                          </Link>
                        </>
                      )}
                      {user.role === "ADMIN" && (
                        <Link
                          href="/admin/activity"
                          role="menuitem"
                          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Activity className="size-4" />
                          My activity
                        </Link>
                      )}
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          role="menuitem"
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <LogOut className="size-4" />
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        {/* While the "Working as" pill floats at the bottom, leave room at the end of
            the page so it never covers the last row of content. */}
        <main
          className={cn(
            "p-4 pb-[calc(var(--app-bar,0px)+1.25rem)] lg:p-8",
            acting && "pb-[calc(var(--app-bar,0px)+6rem)] lg:pb-24",
          )}
        >
          {children}
        </main>
      </div>

      {/* Phone app bar: the department's main pages + Menu (the full menu). */}
      {hasTabs && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
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
                      "relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
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
                  "relative flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
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

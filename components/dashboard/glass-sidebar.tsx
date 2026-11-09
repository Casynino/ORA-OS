"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LogOut,
  Moon,
  Search,
  Shield,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/lib/actions/auth";
import { cn, humanize } from "@/lib/utils";
import { ICONS, type NavGroup, type NavItem } from "@/components/dashboard/nav-data";

/**
 * THE SIDEBAR: the glass panel from Target Express and Super Drive, on every ORA department.
 *
 * A tall, very round, frosted panel — dark purple glass at night, white glass by day — with the
 * opening pages under MAIN and the folding groups under WORKSPACE, the open page marked by a bright
 * bar and a pink icon, page search, and the signed-in person at the bottom (their menu holds
 * profile, night / day, the main site and Sign out). The round button on its edge folds it to a
 * rail where every page is its own icon. The look lives in globals.css (.glass-*).
 *
 * One component draws it for the computer and for the phone's drawer, so the two never drift apart.
 */

export type SidebarUser = {
  name?: string | null;
  email?: string | null;
  role?: string;
  avatar?: string | null;
  preferredName?: string | null;
};

const LABEL = "pb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] g-dim";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function GlassSidebar({
  mode,
  nav,
  user,
  homeHref,
  areaLabel,
  profileHref,
  activeHref,
  collapsed = false,
  onCollapsedChange,
  onNavigate,
  onClose,
}: {
  mode: "desktop" | "sheet";
  nav: NavGroup[];
  user: SidebarUser;
  homeHref: string;
  areaLabel?: string;
  profileHref?: string;
  /** The longest nav href the current page matches (worked out once by the shell). */
  activeHref: string;
  collapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const rail = mode === "desktop" && collapsed;
  // The phone's drawer is read close up with no room to spare, so it runs a size smaller.
  const sheet = mode === "sheet";

  // A group with a label and 2+ pages folds; single pages are plain rows.
  const isGroup = (g: NavGroup) => !!g.label && g.items.length > 1;
  const firstGroup = nav.findIndex(isGroup);
  const activeGroup = nav.find((g) => isGroup(g) && g.items.some((i) => i.href === activeHref))?.label ?? null;

  // ── Folding groups: the group you are in is open; the rest remember what you chose (this device).
  const storeKey = `ora-nav-open:${homeHref}`;
  const [openKeys, setOpenKeys] = useState<string[]>(() => (activeGroup ? [activeGroup] : []));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved)) {
        const keep = saved.filter((k): k is string => typeof k === "string");
        setOpenKeys((prev) => Array.from(new Set([...keep, ...prev])));
      }
    } catch {
      /* storage blocked — the menu starts at its default */
    }
  }, [storeKey]);
  useEffect(() => {
    if (activeGroup) setOpenKeys((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);
  function toggleGroup(key: string) {
    const next = openKeys.includes(key) ? openKeys.filter((k) => k !== key) : [...openKeys, key];
    setOpenKeys(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  // ── Page search
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const focusAfterOpen = useRef(false);
  const [shortcut, setShortcut] = useState("⌘K");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setShortcut("Ctrl K");
  }, []);
  useEffect(() => setQuery(""), [pathname]);

  // ⌘K / Ctrl K reaches the page search from anywhere; [ folds and unfolds.
  useEffect(() => {
    if (mode !== "desktop") return;
    const onKey = (event: KeyboardEvent) => {
      if (window.innerWidth < 1024) return;
      const el = event.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (collapsed) {
          focusAfterOpen.current = true;
          onCollapsedChange?.(false);
        } else {
          searchRef.current?.focus();
          searchRef.current?.select();
        }
      } else if (event.key === "[" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        onCollapsedChange?.(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, collapsed, onCollapsedChange]);
  useEffect(() => {
    if (!collapsed && focusAfterOpen.current) {
      focusAfterOpen.current = false;
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [collapsed]);

  // Search runs over every page this person can open; a group's name finds its pages too
  // ("sales" finds Orders, History, Sell…).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const seen = new Set<string>();
    const out: { item: NavItem; where: string | null }[] = [];
    for (const g of nav) {
      for (const item of g.items) {
        if (seen.has(item.href)) continue;
        const words = [item.label, ...(isGroup(g) && g.label ? [g.label] : [])];
        if (!words.some((w) => w.toLowerCase().includes(q))) continue;
        seen.add(item.href);
        out.push({ item, where: isGroup(g) ? (g.label ?? null) : null });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, nav]);

  // The name beside a rail icon. Fixed to the viewport and drawn outside the panel: the panel's
  // frosted glass would otherwise trap it, and the list scrolling inside would cut it off.
  const [hint, setHint] = useState<{ label: string; x: number; y: number } | null>(null);
  const showHint = (target: EventTarget | null) => {
    const el = rail ? (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-hint]") : null;
    if (!el) {
      setHint(null);
      return;
    }
    const box = el.getBoundingClientRect();
    setHint({ label: el.dataset.hint ?? "", x: box.right + 12, y: box.top + box.height / 2 });
  };

  const brand = (compact: boolean) => (
    <Link
      href={homeHref}
      onClick={onNavigate}
      data-hint="ORA-Pads"
      className={cn("flex min-w-0 items-center rounded-full", sheet ? "gap-2.5" : "gap-3", FOCUS)}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent ring-2 ring-white/25",
          sheet ? "size-9" : "size-10",
        )}
      >
        <Logo mark="light" className={cn("w-auto", sheet ? "h-[18px]" : "h-5")} />
      </span>
      {compact ? null : (
        <span className="min-w-0 leading-tight">
          <span className={cn("block truncate font-semibold tracking-tight g-strong", sheet ? "text-[13px]" : "text-sm")}>
            ORA-Pads
          </span>
          {areaLabel && <span className={cn("mt-0.5 block truncate g-soft", sheet ? "text-[11px]" : "text-xs")}>{areaLabel}</span>}
        </span>
      )}
    </Link>
  );

  const row = (item: NavItem, child = false, where: string | null = null) => {
    const Icon = ICONS[item.icon] ?? LayoutDashboard;
    const active = item.href === activeHref;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex items-center rounded-lg",
            FOCUS,
            sheet
              ? cn("gap-2.5 px-2.5 text-[12.5px]", child ? "min-h-7 py-1" : "min-h-8 py-1.5")
              : cn("gap-3 text-[13px]", child ? "px-3 py-1.5" : "px-3 py-2"),
            active ? "glass-active font-medium g-strong" : "glass-row g-text g-hover",
          )}
        >
          <Icon
            className={cn(
              "shrink-0",
              child ? (sheet ? "size-[15px]" : "size-4") : sheet ? "size-4" : "size-[18px]",
              active && "g-accent",
            )}
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {/* Which group a search result lives in, so two "History" rows are told apart. */}
          {where ? <span className="shrink-0 text-[11px] g-soft">{where}</span> : null}
        </Link>
      </li>
    );
  };

  /** The full menu: name, search, MAIN, WORKSPACE (folding groups with branches), and the person. */
  const full = (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex items-center justify-between gap-2", sheet ? "px-3 pb-2 pr-3 pt-3" : "px-4 pb-3 pr-7 pt-4")}>
        {brand(false)}
        {sheet && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={cn("glass-row grid size-9 shrink-0 place-items-center rounded-full g-text", FOCUS)}
          >
            <X className="size-4" />
            <span className="sr-only">Close menu</span>
          </button>
        ) : null}
      </div>

      <div className={cn("pb-1.5", sheet ? "px-2.5" : "px-3")}>
        <label
          className={cn("glass-field flex items-center gap-2.5 g-soft", sheet ? "px-2.5 py-1.5 text-[13px]" : "px-3.5 py-2 text-sm")}
        >
          <Search className={cn("shrink-0", sheet ? "size-[15px]" : "size-4")} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results?.[0]) {
                event.preventDefault();
                setQuery("");
                onNavigate?.();
                router.push(results[0].item.href);
              } else if (event.key === "Escape") {
                if (query) setQuery("");
                else event.currentTarget.blur();
              }
            }}
            placeholder="Search pages"
            aria-label="Search pages"
            className={cn("g-input g-strong min-w-0 flex-1 bg-transparent outline-none", sheet ? "text-[13px]" : "text-sm")}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className="g-soft g-hover grid size-5 shrink-0 place-items-center rounded-full"
            >
              <X className="size-3.5" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : (
            <kbd className="glass-kbd g-soft hidden shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[10px] font-semibold lg:block">
              {shortcut}
            </kbd>
          )}
        </label>
      </div>

      <nav aria-label="Navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 scrollbar-thin">
        {results ? (
          results.length ? (
            <ul className="mt-2 space-y-0.5">{results.map(({ item, where }) => row(item, false, where))}</ul>
          ) : (
            <p className="g-soft px-4 py-6 text-center text-sm">No page matches that.</p>
          )
        ) : (
          nav.map((group, index) => {
            // MAIN over the pages that open the menu, WORKSPACE over the groups; pages after the
            // groups sit under a hairline, keeping the order each department's menu was given.
            const heading = index === 0 && !isGroup(group) ? "Main" : index === firstGroup ? "Workspace" : null;
            const afterGroups = !isGroup(group) && firstGroup !== -1 && index > firstGroup;

            if (!isGroup(group)) {
              return (
                <div key={group.label ?? `flat-${index}`} className={cn(index > 0 && !afterGroups && "mt-2")}>
                  {heading ? <p className={cn(LABEL, sheet ? "px-3 pt-2.5" : "px-4 pt-3")}>{heading}</p> : null}
                  {afterGroups && index === nav.findIndex((g, i) => i > firstGroup && !isGroup(g)) ? (
                    <div aria-hidden className="glass-divider mx-3 my-2.5" />
                  ) : null}
                  <ul className="space-y-0.5">{group.items.map((item) => row(item))}</ul>
                </div>
              );
            }

            const key = group.label as string;
            const here = group.items.some((item) => item.href === activeHref);
            const isOpen = openKeys.includes(key);
            const GroupIcon = ICONS[group.icon ?? group.items[0].icon] ?? LayoutDashboard;
            return (
              <div key={key} className="mt-0.5">
                {heading ? <p className={cn(LABEL, sheet ? "px-3 pt-3" : "px-4 pt-4")}>{heading}</p> : null}
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  aria-expanded={isOpen}
                  className={cn(
                    "glass-row g-hover flex w-full items-center rounded-lg text-left font-medium",
                    FOCUS,
                    sheet ? "min-h-8 gap-2.5 px-2.5 py-1.5 text-[12.5px]" : "gap-3 px-3 py-2 text-[13px]",
                    here ? "g-strong" : "g-text",
                  )}
                >
                  <GroupIcon className={cn("shrink-0", sheet ? "size-4" : "size-[18px]", here ? "g-accent" : "g-icon")} />
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <ChevronDown className={cn("g-icon size-[15px] shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden" inert={!isOpen}>
                    <ul className="glass-tree ml-[1.7rem] mt-1 space-y-0.5 pb-1 pl-3.5">{group.items.map((item) => row(item, true))}</ul>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </nav>

      <Footer mode={mode} rail={false} user={user} profileHref={profileHref} onNavigate={onNavigate} />
    </div>
  );

  /** The narrow rail: only icons, thin lines between the sets, and the person. */
  const railView = (
    <div className="flex min-h-0 flex-1 flex-col items-center">
      <div className="pb-2 pt-4">{brand(true)}</div>
      <button
        type="button"
        data-hint="Search pages"
        onClick={() => {
          focusAfterOpen.current = true;
          onCollapsedChange?.(false);
        }}
        className={cn("glass-row g-text g-hover mb-1 grid size-11 shrink-0 place-items-center rounded-full", FOCUS)}
      >
        <Search className="size-[18px]" />
        <span className="sr-only">Search pages</span>
      </button>
      <nav
        aria-label="Navigation"
        className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Every page is its own icon, a plain link: nothing opens, its name appears beside it on hover. */}
        {nav.map((group, gi) => (
          <div key={group.label ?? `rail-${gi}`} className="flex w-full flex-col items-center">
            <div aria-hidden className="glass-divider my-1.5 w-7" />
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-hint={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative mb-0.5 grid size-10 shrink-0 place-items-center rounded-full",
                    FOCUS,
                    active ? "glass-active g-strong" : "glass-row g-soft g-hover",
                  )}
                >
                  <Icon className={cn("size-[17px]", active && "g-accent")} />
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <Footer mode={mode} rail user={user} profileHref={profileHref} onNavigate={onNavigate} />
    </div>
  );

  if (sheet) {
    return <div className="glass-panel glass-drawer h-full">{full}</div>;
  }

  return (
    <aside
      aria-label="Navigation"
      onPointerOver={(event) => showHint(event.target)}
      onPointerLeave={() => setHint(null)}
      onFocusCapture={(event) => showHint(event.target)}
      onBlurCapture={() => setHint(null)}
      className={cn("fixed left-3 top-3 z-30 hidden lg:block print:hidden", rail ? "w-[4.5rem]" : "bottom-3 w-56")}
    >
      <div className={cn("glass-panel flex flex-col", rail ? "max-h-[calc(100dvh-1.5rem)]" : "h-full")}>{rail ? railView : full}</div>

      {/* Fold and unfold, on the panel's own edge. */}
      <div className="group absolute -right-3.5 top-[1.65rem] z-10">
        <button
          type="button"
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-expanded={!collapsed}
          className="glass-chip grid size-7 place-items-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.4)] ring-1 ring-black/10 outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary dark:ring-white/10"
        >
          {collapsed ? <ChevronRight className="size-[15px]" strokeWidth={2.5} /> : <ChevronLeft className="size-[15px]" strokeWidth={2.5} />}
          <span className="sr-only">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
        <span className="glass-chip pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold opacity-0 shadow-lg transition group-hover:opacity-100">
          {collapsed ? "Expand" : "Collapse"}{" "}
          <kbd className="ml-1 rounded bg-black/5 px-1 font-sans text-[10px] opacity-70 dark:bg-white/10">[</kbd>
        </span>
      </div>

      {hint ? (
        <span
          role="tooltip"
          className="glass-chip pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold shadow-lg"
          style={{ left: hint.x, top: hint.y }}
        >
          {hint.label}
        </span>
      ) : null}
    </aside>
  );
}

/**
 * The bottom of the panel: the signed-in person, as their picture (or initials) and first name.
 * A small menu opens from it: the full name and role, My profile, Security, the night or day look,
 * the main site, Sign out. It is drawn into the page (a portal) so the panel's frosted glass can
 * neither trap nor cut it off. In the rail only the picture shows.
 */
function Footer({
  mode,
  rail,
  user,
  profileHref,
  onNavigate,
}: {
  mode: "desktop" | "sheet";
  rail: boolean;
  user: SidebarUser;
  profileHref?: string;
  onNavigate?: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const full = user.name ?? user.email ?? "Account";
  const shown = (user.preferredName || user.name || "Account").trim();
  const firstName = shown.split(/\s+/)[0] ?? shown;
  const role = user.role ? humanize(user.role) : "";
  const item =
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const box = trigger.current?.getBoundingClientRect();
    if (box) {
      const width = 224;
      const left = rail ? box.right + 12 : Math.min(box.left, window.innerWidth - width - 12);
      setPos({ left: Math.max(12, left), bottom: window.innerHeight - box.bottom + (rail ? 0 : box.height + 8) });
    }
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div
      className={cn(
        "shrink-0",
        rail ? "flex flex-col items-center pb-3" : "px-3 pb-3",
        mode === "sheet" && "pb-[max(0.75rem,var(--sab))]",
      )}
    >
      <div aria-hidden className="glass-divider mb-2 w-full" />
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={full}
        data-hint={full}
        className={cn(
          "glass-row flex w-full items-center gap-3 rounded-full text-left",
          FOCUS,
          rail ? "justify-center p-1" : mode === "sheet" ? "px-1.5 py-1.5" : "px-2 py-2",
        )}
      >
        <span
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-white ring-1 ring-white/25",
            mode === "sheet" ? "size-9" : "size-10",
          )}
        >
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="size-full object-cover" />
          ) : (
            initials(shown)
          )}
        </span>
        {rail ? (
          <span className="sr-only">{full}</span>
        ) : (
          <span className="min-w-0 flex-1 leading-tight">
            <span className={cn("g-strong block truncate font-semibold", mode === "sheet" ? "text-[13px]" : "text-sm")}>{firstName}</span>
            {role && <span className="g-soft block truncate text-[11px]">{role}</span>}
          </span>
        )}
      </button>

      {open && pos
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
              <div
                role="menu"
                style={{ left: pos.left, bottom: pos.bottom }}
                className="fixed z-[96] w-56 animate-fade-in rounded-2xl border border-border bg-card p-1.5 shadow-glow"
              >
                <div className="border-b border-border px-3 pb-2.5 pt-1.5">
                  <p className="break-words text-[13px] font-semibold leading-snug">{full}</p>
                  {role && <p className="truncate text-[11px] text-muted-foreground">{role}</p>}
                </div>
                <div className="pt-1">
                  {profileHref && (
                    <>
                      <Link href={profileHref} role="menuitem" onClick={close} className={item}>
                        <UserRound className="size-4" /> My profile
                      </Link>
                      <Link href={`${profileHref}#security`} role="menuitem" onClick={close} className={item}>
                        <Shield className="size-4" /> Security
                      </Link>
                    </>
                  )}
                  {user.role === "ADMIN" && (
                    <Link href="/admin/activity" role="menuitem" onClick={close} className={item}>
                      <Activity className="size-4" /> My activity
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
                    onClick={() => setTheme(dark ? "light" : "dark")}
                    className={item}
                  >
                    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                    {dark ? "Light" : "Dark"}
                  </button>
                  <Link href="/" role="menuitem" onClick={close} className={item}>
                    <Globe className="size-4" /> Main site
                  </Link>
                  <div aria-hidden className="my-1 h-px bg-border" />
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className={cn(item, "hover:bg-destructive/10 hover:text-destructive")}
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </form>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

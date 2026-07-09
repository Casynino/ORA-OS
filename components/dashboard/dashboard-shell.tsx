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
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventory: Package,
  catalogue: Boxes,
  requests: ClipboardList,
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
};

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { label?: string; items: NavItem[] };

export function DashboardShell({
  nav,
  user,
  areaLabel,
  profileHref,
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
  areaLabel: string;
  profileHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const homeHref = nav[0]?.items[0]?.href ?? "/";
  const displayName = user.preferredName || user.name;

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

  const isActive = (href: string) =>
    pathname === href ||
    (href !== homeHref && pathname.startsWith(href + "/"));

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-4">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const UserCard = () => (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <Avatar name={user.name} src={user.avatar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 via-background to-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Link href={homeHref}>
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {areaLabel}
          </p>
          <NavLinks />
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
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserCard />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <span className="font-display font-semibold lg:hidden">
              {areaLabel}
            </span>
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
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

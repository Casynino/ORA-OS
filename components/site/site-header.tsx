"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/public/social-links";
import { Magnetic, EASE } from "@/components/site/motion";
import { ORA_CONTACT } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { name: "Products", href: "/products" },
  { name: "Impact", href: "/impact" },
  { name: "Education", href: "/education" },
  { name: "Find ORA", href: "/find-ora" },
  { name: "News", href: "/news" },
  { name: "Contact", href: "/contact" },
];

function homeFor(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "FINANCE") return "/finance";
  if (role === "WAREHOUSE") return "/warehouse";
  if (role === "SALES_REP") return "/rep";
  return "/partner";
}

/**
 * The public site's header (home and every public page): transparent over the dark hero, a blurred night bar once
 * the page moves. On a phone "Menu" opens a full-screen night sheet with big staggered links, like the Reckless site.
 */
export function SiteHeader({ user }: { user?: { name?: string | null; role?: string } | null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 pt-[var(--sat)] transition-[background-color,border-color,backdrop-filter] duration-300",
          scrolled && !open ? "border-b border-white/[0.07] bg-[rgb(11_6_18/0.72)] backdrop-blur-xl" : "border-b border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-5 sm:h-[72px] sm:px-8">
          <Link href="/" aria-label="ORA-Pads home" className="relative z-[60] shrink-0">
            <Logo mark="light" className="h-9 sm:h-10" />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className="group relative py-2 text-[13px] font-medium tracking-wide text-white/70 transition-colors hover:text-white">
                  {n.name}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 left-0 h-px w-full origin-left bg-[rgb(var(--s-pink))] transition-transform duration-300",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="relative z-[60] flex items-center gap-3 sm:gap-5">
            {user ? (
              <Link href={homeFor(user.role)} className="hidden text-[13px] font-medium text-white/75 transition-colors hover:text-white sm:inline">
                My home
              </Link>
            ) : (
              <Link href="/login" className="hidden text-[13px] font-medium text-white/75 transition-colors hover:text-white sm:inline">
                Sign in
              </Link>
            )}
            <Magnetic className="hidden sm:inline-block">
              <Link
                href="/impact"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[rgb(var(--s-pink))] px-5 text-[13px] font-semibold text-white shadow-[0_8px_30px_-8px_rgb(255_63_168/0.7)] transition-transform active:scale-[0.97]"
              >
                Join the movement
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="flex h-10 items-center gap-2.5 rounded-full border border-white/15 pl-4 pr-3 text-[12px] font-medium uppercase tracking-[0.18em] text-white lg:hidden"
            >
              {open ? "Close" : "Menu"}
              <span className="relative block h-2.5 w-4">
                <span className={cn("absolute left-0 h-px w-4 bg-white transition-transform duration-300", open ? "top-1 rotate-45" : "top-0")} />
                <span className={cn("absolute left-0 h-px w-4 bg-white transition-transform duration-300", open ? "top-1 -rotate-45" : "top-2")} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.7, ease: EASE }}
            className="ora-site fixed inset-0 z-[55] flex flex-col overflow-y-auto px-6 pb-[calc(var(--sab)+1.5rem)] pt-[calc(var(--sat)+6rem)] lg:hidden"
          >
            <nav aria-label="Main" className="flex flex-col">
              {[{ name: "Home", href: "/" }, ...NAV].map((n, i) => (
                <motion.div
                  key={n.href}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.7, ease: EASE }}
                  className="border-b border-white/[0.08]"
                >
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex items-baseline justify-between gap-4 py-3.5">
                    <span className="font-site-display text-[clamp(1.9rem,8.5vw,2.6rem)] font-medium uppercase leading-none tracking-[-0.02em]">{n.name}</span>
                    <span className="s-label">0{i + 1}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.6 }} className="mt-8 grid gap-3">
              <Link href="/impact" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-full bg-[rgb(var(--s-pink))] text-[15px] font-semibold text-white">
                Join the movement
              </Link>
              <Link
                href={user ? homeFor(user.role) : "/login"}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center gap-1.5 rounded-full border border-white/15 text-[15px] text-white"
              >
                {user ? "My home" : "Sign in"} <ArrowUpRight className="size-4" strokeWidth={1.5} />
              </Link>
              <div className="mt-6 flex items-center justify-between">
                <a href={ORA_CONTACT.phoneHref} className="s-label text-white/70">{ORA_CONTACT.phoneDisplay}</a>
                <SocialLinks itemClassName="size-9 bg-white/[0.06] text-white/75 hover:bg-white/10 hover:text-white" iconClassName="size-4" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

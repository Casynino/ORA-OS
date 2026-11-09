"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SocialLinks } from "@/components/public/social-links";
import { cn } from "@/lib/utils";

const nav = [
  { name: "About", href: "#about" },
  { name: "Products", href: "/products" },
  { name: "Find ORA", href: "/find-ora" },
  { name: "Education", href: "/education" },
  { name: "Impact", href: "/impact" },
  { name: "News", href: "/news" },
  { name: "Activities", href: "#activities" },
  { name: "Contact", href: "/contact" },
];

/**
 * The home page's header: transparent over the plum hero, a solid plum bar with a hairline once the page scrolls.
 * Logo, the links, a quiet "Sign in" and one button. On a phone the links fold into one menu.
 */
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 pt-[var(--sat)] transition-colors duration-200",
        solid ? "border-b border-white/[0.08] bg-[#0d0016]" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="ORA-Pads home" className="shrink-0">
          <Logo mark="light" className="h-9" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 xl:flex">
          {nav.map((n) => (
            <Link key={n.name} href={n.href} className="text-[14px] text-white/70 transition-colors hover:text-white">
              {n.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle className="hidden border-white/15 bg-transparent text-white/80 sm:inline-flex" />
          <Link href="/login" className="hidden text-[14px] text-white/70 transition-colors hover:text-white sm:inline">
            Sign in
          </Link>
          <Link
            href="/impact"
            className="hidden h-9 items-center rounded-full bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] sm:inline-flex"
          >
            Join the movement
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex size-10 items-center justify-center rounded-lg text-white xl:hidden"
          >
            {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="ora-rise border-t border-white/[0.08] bg-[#0d0016] xl:hidden">
          <nav aria-label="Main" className="container flex max-h-[calc(100svh-4rem)] flex-col overflow-y-auto py-2">
            {nav.map((n) => (
              <Link
                key={n.name}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center border-b border-white/[0.06] text-[15px] text-white/80 transition-colors hover:text-white"
              >
                {n.name}
              </Link>
            ))}
            <div className="mt-4 flex gap-3">
              <Link
                href="/impact"
                onClick={() => setOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-medium text-primary-foreground"
              >
                Join the movement
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-full border border-white/15 text-[15px] text-white"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-5 flex items-center justify-between pb-3">
              <SocialLinks itemClassName="size-9 bg-white/[0.06] text-white/75 hover:bg-white/10 hover:text-white" iconClassName="size-4" />
              <ThemeToggle className="border-white/15 bg-transparent text-white/80" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

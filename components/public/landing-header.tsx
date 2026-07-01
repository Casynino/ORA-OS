"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Heart } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SocialLinks } from "@/components/public/social-links";
import { cn } from "@/lib/utils";

const nav = [
  { name: "Home", href: "/" },
  { name: "About Us", href: "#about" },
  { name: "Products", href: "/products" },
  { name: "Education", href: "/education" },
  { name: "Impact", href: "/impact" },
  { name: "News", href: "/news" },
  { name: "Activities", href: "#activities" },
  { name: "Contact", href: "/contact" },
  { name: "Join Us", href: "/request-access" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-3",
      )}
    >
      <div className="container">
        <div
          className={cn(
            "flex items-center justify-between rounded-2xl px-3 py-2 transition-all duration-300 sm:px-5",
            scrolled &&
              "border border-white/10 bg-[#0d0016]/70 shadow-soft backdrop-blur-xl",
          )}
        >
          <Link href="/" aria-label="home">
            <Logo mark="light" className="h-9" />
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {nav.map((n) => (
              <Link
                key={n.name}
                href={n.href}
                className="text-sm font-medium text-white/75 transition-colors hover:text-primary"
              >
                {n.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden border-white/15 bg-white/10 sm:inline-flex" />
            <Link
              href="/donate"
              className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
            >
              <Heart className="size-4" />
              Support a Girl
            </Link>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="flex size-9 items-center justify-center rounded-lg text-white xl:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#0d0016]/90 p-4 backdrop-blur-xl xl:hidden">
            <div className="flex flex-col gap-1">
              {nav.map((n) => (
                <Link
                  key={n.name}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/5 hover:text-white"
                >
                  {n.name}
                </Link>
              ))}
              <div className="mt-2 flex items-center justify-between px-3">
                <span className="text-sm text-white/60">Theme</span>
                <ThemeToggle className="border-white/15 bg-white/10" />
              </div>
              <div className="mt-1 flex items-center justify-between px-3">
                <span className="text-sm text-white/60">Follow ORA</span>
                <SocialLinks
                  itemClassName="size-8 bg-white/10 text-white/80 hover:bg-primary hover:text-white"
                  iconClassName="size-4"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

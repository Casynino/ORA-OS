"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { SocialLinks } from "@/components/public/social-links";

const nav = [
  { href: "/impact", label: "Impact" },
  { href: "/education", label: "Education" },
  { href: "/find-ora", label: "Find ORA" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Join Us" },
];

function dash(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "FINANCE") return "/finance";
  if (role === "WAREHOUSE") return "/warehouse";
  if (role === "SALES_REP") return "/rep";
  return "/partner";
}

export function SiteHeader({
  user,
}: {
  user?: { name?: string | null; role?: string } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[var(--sat)]">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="ORA-Pads home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link
              href={dash(user.role)}
              className={buttonVariants({ size: "sm" })}
            >
              <LayoutDashboard className="size-4" strokeWidth={1.5} />
              My home
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground">
                Sign in
              </Link>
              <Link
                href="/impact"
                className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[14px] font-medium text-primary-foreground transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97]"
              >Join the movement</Link>
            </>
          )}
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <div className="ora-rise border-t border-border bg-background md:hidden">
          <div className="container flex flex-col py-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center border-b border-border text-[15px] text-foreground/80 transition-colors hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-4 flex gap-3">
              {user ? (
                <Link
                  href={dash(user.role)}
                  className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-medium text-primary-foreground"
                  onClick={() => setOpen(false)}
                >
                  Go to my home
                </Link>
              ) : (
                <>
                  <Link
                    href="/impact"
                    className="flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-[15px] font-medium text-primary-foreground"
                    onClick={() => setOpen(false)}
                  >Join the movement</Link>
                  <Link
                    href="/login"
                    className="flex h-11 flex-1 items-center justify-center rounded-full border border-border text-[15px]"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <div className="mt-5 flex items-center justify-between pb-3">
              <span className="text-sm text-muted-foreground">Follow ORA</span>
              <SocialLinks
                itemClassName="size-8 bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                iconClassName="size-4"
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { SocialLinks } from "@/components/public/social-links";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/impact", label: "Impact" },
  { href: "/education", label: "Education" },
  { href: "/find-ora", label: "Find ORA" },
  { href: "/donate", label: "Donate" },
  { href: "/contact", label: "Contact" },
  { href: "/request-access", label: "Join Us" },
];

function dash(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "WAREHOUSE") return "/warehouse";
  return "/partner";
}

export function SiteHeader({
  user,
}: {
  user?: { name?: string | null; role?: string } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="ORA-Pads home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Sign in
              </Link>
              <Link
                href="/donate"
                className={buttonVariants({ size: "sm" })}
              >
                Donate
              </Link>
            </>
          )}
        </div>

        <button
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container flex flex-col gap-1 py-3">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <Link
                  href={dash(user.role)}
                  className={buttonVariants({ size: "sm" })}
                  onClick={() => setOpen(false)}
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/donate"
                    className={buttonVariants({ size: "sm" })}
                    onClick={() => setOpen(false)}
                  >
                    Donate
                  </Link>
                </>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border px-3 pt-3">
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

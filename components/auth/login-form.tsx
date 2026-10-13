"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ShieldCheck, Users } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

type Mode = "staff" | "developer";

const OPTIONS: { mode: Mode; label: string; icon: typeof Users }[] = [
  { mode: "staff", label: "Staff login", icon: Users },
  { mode: "developer", label: "Developer login", icon: ShieldCheck },
];

export function LoginForm({ initialMode = "staff" }: { initialMode?: Mode }) {
  const [state, action] = useActionState(loginAction, null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const isDev = mode === "developer";

  return (
    <form action={action} className="space-y-4">
      {/* Which door — Staff (Admin, Finance, Sales, Warehouse, Partners) or the
          dedicated Developer account. Posted to the server, which enforces it. */}
      <input type="hidden" name="mode" value={mode} />
      <div
        role="tablist"
        aria-label="Choose how to sign in"
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1"
      >
        {OPTIONS.map(({ mode: m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              mode === m
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {isDev && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Technical maintenance account. Requires your password and a code from
          your authenticator app. Every action is audited.
        </p>
      )}

      {state && !state.ok && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="mt-1.5"
        />
      </div>

      {isDev && (
        <div>
          <Label htmlFor="code">Authenticator code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            placeholder="6-digit code"
            required
            className="mt-1.5 tracking-widest"
          />
        </div>
      )}

      <SubmitButton className="w-full" pendingText="Signing in…">
        {isDev ? "Sign in as Developer" : "Sign in"}
      </SubmitButton>

      {!isDev && (
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/request-access"
            className="font-medium text-primary hover:underline"
          >
            Request access
          </Link>
        </p>
      )}
    </form>
  );
}

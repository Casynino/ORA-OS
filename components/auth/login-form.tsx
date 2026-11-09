"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-3.5">
      {state && !state.ok && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/15 p-3 text-[13px] text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email" className="text-[13px] font-normal text-white/70">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/[0.06] text-[15px] text-white placeholder:text-white/35 focus-visible:border-primary/60 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
        />
      </div>

      <div>
        <Label htmlFor="password" className="text-[13px] font-normal text-white/70">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          wrapperClassName="mt-1.5 [&_button]:text-white/55 [&_button:hover]:bg-white/10 [&_button:hover]:text-white"
          className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-[15px] text-white placeholder:text-white/35 focus-visible:border-primary/60 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
        />
      </div>

      <SubmitButton className="!mt-5 h-11 w-full rounded-full text-[15px] font-medium" pendingText="Signing in…">
        Sign in
      </SubmitButton>

      <p className="pt-1 text-center text-[13px] text-white/60">
        New here?{" "}
        <Link
          href="/request-access"
          className="font-medium text-white underline-offset-4 hover:underline"
        >
          Request access
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { loginAction } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
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

      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/request-access"
          className="font-medium text-primary hover:underline"
        >
          Request access
        </Link>
      </p>
    </form>
  );
}

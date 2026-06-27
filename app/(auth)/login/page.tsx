import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-2 text-muted-foreground">
        Sign in to your ORA-Pads account.
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>
    </div>
  );
}

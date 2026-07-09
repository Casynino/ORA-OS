import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, dashboardPath } from "@/lib/rbac";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Validated against the database (unlike the edge middleware), so a session
  // revoked via "sign out everywhere" correctly lands here instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(dashboardPath(user.role));

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

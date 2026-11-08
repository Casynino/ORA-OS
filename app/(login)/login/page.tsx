import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/login-screen";
import { getCurrentUser, dashboardPath } from "@/lib/rbac";
import { getPublicImpactStats } from "@/lib/stats";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Validated against the database (unlike the edge middleware), so a session
  // revoked via "sign out everywhere" correctly lands here instead of looping.
  const user = await getCurrentUser();
  if (user) redirect(dashboardPath(user.role));

  // Baseline figures if the database is unavailable.
  let pads = 6000;
  let communities = 42;
  try {
    const s = await getPublicImpactStats();
    pads = s.padsDistributed;
    communities = s.communities;
  } catch {
    /* keep the baseline */
  }

  // Sent here from a protected page (session ended / not signed in): open the
  // sign-in pop-up straight away instead of making them tap "Log in" first.
  const { callbackUrl } = await searchParams;

  return <LoginScreen pads={pads} communities={communities} autoOpen={!!callbackUrl} />;
}

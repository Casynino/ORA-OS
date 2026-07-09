import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

function dashboardFor(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "WAREHOUSE") return "/warehouse";
  if (role === "SALES_REP") return "/rep";
  return "/partner";
}

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;
  const path = nextUrl.pathname;
  const inAdmin = path.startsWith("/admin");
  const inWarehouse = path.startsWith("/warehouse");
  const inPartner = path.startsWith("/partner");
  const inRep = path.startsWith("/rep");
  const isProtected = inAdmin || inWarehouse || inPartner || inRep;

  // Note: signed-in users are bounced away from /login by the login page
  // itself (Node runtime, DB-validated) — the edge token here can be stale
  // after a 'sign out everywhere', which would cause a redirect loop.

  // Gate protected areas behind authentication.
  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }

  // Keep each role inside its own area.
  if (isLoggedIn) {
    if (inAdmin && role !== "ADMIN")
      return Response.redirect(new URL(dashboardFor(role), nextUrl));
    if (inWarehouse && role !== "WAREHOUSE")
      return Response.redirect(new URL(dashboardFor(role), nextUrl));
    if (inPartner && role !== "PARTNER")
      return Response.redirect(new URL(dashboardFor(role), nextUrl));
    if (inRep && role !== "SALES_REP")
      return Response.redirect(new URL(dashboardFor(role), nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

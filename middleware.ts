import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

function dashboardFor(role?: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "WAREHOUSE") return "/warehouse";
  return "/partner";
}

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session?.user;
  const role = session?.user?.role;
  const path = nextUrl.pathname;

  const isAuthPage = path === "/login" || path === "/request-access";
  const inAdmin = path.startsWith("/admin");
  const inWarehouse = path.startsWith("/warehouse");
  const inPartner = path.startsWith("/partner");
  const isProtected = inAdmin || inWarehouse || inPartner;

  // Signed-in users never see the auth pages — bounce to their home.
  if (isAuthPage && isLoggedIn) {
    return Response.redirect(new URL(dashboardFor(role), nextUrl));
  }

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
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};

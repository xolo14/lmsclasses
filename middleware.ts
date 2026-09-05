import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ROLE_ROUTES } from "@/lib/utils";

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/hr/login", "/hr/register"] as const;

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );
  return response;
}

function withAuthNoCache(response: NextResponse, pathname: string) {
  if (AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number])) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");
  }
  return withSecurityHeaders(response);
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";

  // Canonical host: www → apex
  if (host === "www.lmsclasses.com") {
    const url = req.nextUrl.clone();
    url.host = "lmsclasses.com";
    url.protocol = "https:";
    return withSecurityHeaders(NextResponse.redirect(url, 301));
  }

  const role = req.auth?.user?.role;

  const publicPaths = ["/login", "/hr/login", "/hr/register", "/"];
  const isPublic =
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/demo") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/api/hr/register") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/bootstrap") ||
    pathname.startsWith("/api/payments/webhook") ||
    pathname.startsWith("/api/external") ||
    pathname.startsWith("/api/widget") ||
    pathname.startsWith("/api/enroll") ||
    pathname.startsWith("/enroll") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/widget/") ||
    pathname === "/api/payments/create-order";

  if (isPublic) {
    if (role && (pathname === "/login" || pathname === "/")) {
      let dest = "/login";
      if (role === "mentor") {
        dest = "/mentor/live-classes";
      } else if (role === "student") {
        dest = "/student/courses";
      } else if (role === "hr") {
        dest = "/hr/dashboard";
      } else if (role && ROLE_ROUTES[role as keyof typeof ROLE_ROUTES]) {
        dest = `${ROLE_ROUTES[role as keyof typeof ROLE_ROUTES]}/dashboard`;
      }
      return withSecurityHeaders(NextResponse.redirect(new URL(dest, req.url)));
    }
    if (role === "hr" && (pathname === "/hr/login" || pathname === "/hr/register")) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/hr/dashboard", req.url)));
    }
    return withAuthNoCache(NextResponse.next(), pathname);
  }

  if (!role) {
    if (pathname.startsWith("/hr")) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/hr/login", req.url)));
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
  }

  for (const [r, prefix] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix) && role !== r) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
    }
  }

  return withAuthNoCache(NextResponse.next(), pathname);
});

export const config = {
  matcher: [
    /*
     * Skip static assets, Next internals, and uploaded files.
     * Avoid running auth middleware on paths that must return raw bytes/HTML.
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|icon|apple-icon|uploads|.*\\..*).*)",
  ],
};

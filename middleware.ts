import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { publicUrl } from "@/lib/app-url";
import { portalHomeForRole, ROLE_ROUTES } from "@/lib/utils";

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/hr/login", "/hr/register"] as const;

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=(self), display-capture=(self)"
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

function redirectPath(req: Request, path: string) {
  return withSecurityHeaders(NextResponse.redirect(publicUrl(req, path), 302));
}

export default auth((req) => {
  try {
    const { pathname } = req.nextUrl;

    const role = req.auth?.user?.role;

    const publicPaths = ["/login", "/hr/login", "/hr/register", "/", "/privacy", "/terms", "/auth/continue"];
    const isPublic =
      publicPaths.some((p) => pathname === p) ||
      pathname.startsWith("/courses") ||
      pathname.startsWith("/demo") ||
      pathname.startsWith("/api/video") ||
      pathname.startsWith("/api/auth") ||
      pathname === "/api/logout" ||
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
      return withAuthNoCache(NextResponse.next(), pathname);
    }

    if (!role) {
      if (pathname.startsWith("/hr")) {
        return redirectPath(req, "/hr/login");
      }
      return redirectPath(req, "/login");
    }

    const home = portalHomeForRole(role);
    for (const [r, prefix] of Object.entries(ROLE_ROUTES)) {
      if (pathname.startsWith(prefix) && role !== r) {
        if (home === pathname) {
          return withAuthNoCache(NextResponse.next(), pathname);
        }
        return redirectPath(req, home);
      }
    }

    return withAuthNoCache(NextResponse.next(), pathname);
  } catch {
    return withSecurityHeaders(NextResponse.next());
  }
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

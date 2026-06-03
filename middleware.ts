import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { ROLE_ROUTES } from "@/lib/utils";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  const publicPaths = ["/login", "/hr/login", "/hr/register", "/"];
  const isPublic = publicPaths.some(
    (p) =>
      pathname === p ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/hr/register") ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/api/bootstrap")
  );

  if (isPublic) {
    if (role && pathname === "/login") {
      const redirect = ROLE_ROUTES[role] || "/login";
      return NextResponse.redirect(new URL(`${redirect}/dashboard`, req.url));
    }
    return NextResponse.next();
  }

  if (!role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  for (const [r, prefix] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix) && role !== r) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

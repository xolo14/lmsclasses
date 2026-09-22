import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auth.js / NextAuth cookie names we have used across deploys. */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "next-auth.csrf-token",
  "__Secure-next-auth.callback-url",
  "__Host-next-auth.csrf-token",
] as const;

function loginPath(next: string | null): "/login" | "/hr/login" {
  return next === "/hr/login" ? "/hr/login" : "/login";
}

function expireCookie(response: NextResponse, name: string) {
  const secure = name.startsWith("__Secure-") || name.startsWith("__Host-");
  response.cookies.delete(name);
  response.cookies.set({
    name,
    value: "",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
}

/** GET so Hostinger WAF / login rate-limits cannot block sign-out. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dest = loginPath(searchParams.get("next"));
  const response = NextResponse.redirect(new URL(dest, request.url), 302);

  for (const name of SESSION_COOKIES) {
    expireCookie(response, name);
    for (let i = 0; i < 6; i++) expireCookie(response, `${name}.${i}`);
  }

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

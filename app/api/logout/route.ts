import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/app-url";

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

function expireCookie(response: NextResponse, name: string) {
  try {
    const hostPrefixed = name.startsWith("__Host-");
    const secure = hostPrefixed || name.startsWith("__Secure-");
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
  } catch {
    /* Hostinger / Next will reject some __Host- names; still redirect home. */
  }
}

function withExpiredCookies(response: NextResponse) {
  for (const name of SESSION_COOKIES) {
    expireCookie(response, name);
    expireCookie(response, `${name}.0`);
  }
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function homePage(request: Request): NextResponse {
  try {
    return withExpiredCookies(NextResponse.redirect(publicUrl(request, "/"), 302));
  } catch {
    const html =
      '<!doctype html><meta http-equiv="refresh" content="0;url=/"><script>location.replace("/")</script>';
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}

/** GET so Hostinger WAF / login rate-limits cannot block sign-out. Always land on `/`. */
export async function GET(request: Request) {
  return homePage(request);
}

import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Website Google login callback (not under /api).
 * Hostinger hCDN WAF returns plain-text 403 on /api/... when the query
 * includes iss=https://accounts.google.com and Google scope URLs.
 */
function asNextAuthGoogleCallback(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/auth/callback/google";
  return new NextRequest(url, request);
}

export function GET(request: NextRequest) {
  return handlers.GET(asNextAuthGoogleCallback(request));
}

export function POST(request: NextRequest) {
  return handlers.POST(asNextAuthGoogleCallback(request));
}

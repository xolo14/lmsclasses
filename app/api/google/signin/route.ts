import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Website Google login callback.
 * Hostinger WAF returns plain "Forbidden" on `/api/auth/callback/google`
 * (query has `iss=https://…` + `code=`). Calendar already uses `/api/google/*`.
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

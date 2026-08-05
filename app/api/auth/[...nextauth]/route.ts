import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { getClientIp } from "@/lib/audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  const limited = checkRateLimit(`login:ip:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limited.allowed) {
    const rl = rateLimitResponse(
      limited.retryAfterSec,
      "Too many sign-in attempts. Please wait and try again."
    );
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  return handlers.POST(request);
}

import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/** Bearer CRON_SECRET check shared by /api/cron/* routes. Returns a 401 response or null. */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const given = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

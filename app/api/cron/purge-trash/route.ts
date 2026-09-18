import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/trash";
import { autoCompletePastLiveClasses } from "@/lib/api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerMatches(header: string | null, secret: string) {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  try {
    await purgeExpiredTrash();
  } catch (err) {
    console.error("[cron] purge-trash failed:", err);
    errors.push(err instanceof Error ? err.message : "purge failed");
  }

  try {
    await autoCompletePastLiveClasses();
  } catch (err) {
    console.error("[cron] live-class maintenance failed:", err);
    errors.push(err instanceof Error ? err.message : "live-class maintenance failed");
  }

  return NextResponse.json({ ok: errors.length === 0, errors });
}

export async function POST(request: Request) {
  return GET(request);
}

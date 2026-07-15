import { NextResponse } from "next/server";
import { processPendingAutoIssuances } from "@/lib/services/certificate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: issue certificates on the calendar day course duration from enrollment elapses.
 * Protect with Authorization: Bearer $CRON_SECRET
 * Suggested schedule: daily (e.g. every hour or once per day).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingAutoIssuances();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] certificate-auto-issue failed:", err);
    const message = err instanceof Error ? err.message : "Auto-issue failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

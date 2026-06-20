import { NextResponse } from "next/server";
import { processDelayedFollowUpEmails } from "@/lib/widget/lead-admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sent = await processDelayedFollowUpEmails();
  return NextResponse.json({ ok: true, sent });
}

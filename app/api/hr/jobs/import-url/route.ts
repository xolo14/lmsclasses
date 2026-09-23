import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp } from "@/lib/audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { importJobFromPublicUrl } from "@/lib/job-page-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;

  const ip = getClientIp(request) ?? session!.user.id;
  const limited = checkRateLimit(`job-import:${ip}`, 10, 15 * 60 * 1000);
  if (!limited.allowed) {
    const rl = rateLimitResponse(limited.retryAfterSec, "Too many import attempts. Wait and try again.");
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Paste a public job page URL." }, { status: 400 });
  }

  try {
    const draft = await importJobFromPublicUrl(url);
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not import that job page." },
      { status: 400 }
    );
  }
}

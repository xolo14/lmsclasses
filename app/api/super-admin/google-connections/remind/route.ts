import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp, logAction } from "@/lib/audit";
import { sendReconnectReminder } from "@/lib/actions/googleIntegration";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().uuid() });

/**
 * POST /api/super-admin/google-connections/remind  { userId }
 * Emails a host to connect (no connection) or reconnect (needs_reconnect) Google.
 */
export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const admin = session!.user;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const { userId } = parsed.data;

  const limit = checkRateLimit(`google:remind:${userId}`, 1, 60 * 60 * 1000);
  if (!limit.allowed) {
    const r = rateLimitResponse(limit.retryAfterSec, "A reminder was already sent to this user in the last hour.");
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  try {
    const result = await sendReconnectReminder(userId);
    void logAction({
      userId: admin.id,
      role: admin.role,
      action: "google.reminder_sent",
      entity: "User",
      entityId: userId,
      metadata: { kind: result.kind },
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ ok: true, kind: result.kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email could not be sent.";
    const status = /already connected|cannot host/i.test(message) ? 400 : 500;
    if (status === 500) console.error("[google] reminder email failed", message);
    return NextResponse.json({ error: message }, { status });
  }
}

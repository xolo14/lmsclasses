import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getConnection, isGmailAddress } from "@/lib/services/googleAuth";
import { canHostLiveClass } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/google/host-info?userId=…
 * Connection summary for a prospective class host (used by the schedule form).
 * Mentors may only look up themselves; admins/managers any host-capable user. No tokens.
 */
export async function GET(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor", "org_admin"]);
  if (error) return error;
  const user = session!.user;

  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if ((user.role === "mentor" || user.role === "org_admin") && userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [host] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!host || !canHostLiveClass(host.role)) {
    return NextResponse.json({ error: "User cannot host live classes" }, { status: 404 });
  }

  const connection = await getConnection(userId);
  return NextResponse.json(
    {
      userId: host.id,
      name: host.name,
      email: host.email,
      connected: connection?.status === "active",
      status: connection?.status ?? null,
      googleEmail: connection?.googleEmail ?? null,
      isGmail: isGmailAddress(connection?.googleEmail),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

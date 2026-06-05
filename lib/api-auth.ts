import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type Role } from "@/lib/db/schema";

export type AuthSession = Session;

export async function requireAuth(allowedRoles?: Role[]) {
  const session = await auth();

  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }

  return { error: null, session };
}

/** JWT may omit organisationId — resolve from DB for org admins. */
export async function resolveOrganisationId(session: Session): Promise<string | null> {
  if (session.user.organisationId) return session.user.organisationId;
  if (session.user.role !== "org_admin") return null;

  const [row] = await db
    .select({ organisationId: users.organisationId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return row?.organisationId ?? null;
}

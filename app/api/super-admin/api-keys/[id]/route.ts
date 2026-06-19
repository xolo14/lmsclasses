import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: updated.isActive ? "API_KEY_ENABLED" : "API_KEY_DISABLED",
      entity: "ApiKey",
      entityId: id,
      metadata: { name: updated.name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      id: updated.id,
      isActive: updated.isActive,
    });
  } catch (err) {
    console.error("[api/super-admin/api-keys/toggle]:", err);
    return NextResponse.json({ error: "Failed to toggle API key" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_DELETED",
      entity: "ApiKey",
      entityId: id,
      metadata: { name: existing.name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/super-admin/api-keys/delete]:", err);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const { id } = await props.params;

  try {
    const [existing] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    await db
      .update(coupons)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(coupons.id, id));

    try {
      await logAction({
        userId: session!.user.id,
        role: session!.user.role,
        action: "DELETED_COUPON",
        entity: "Coupon",
        entityId: id,
        metadata: { code: existing.code },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error(`[api/super-admin/coupons/[id]] Audit log failed for coupon ${id}:`, auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/super-admin/coupons/[id]] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons, organisations } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { couponSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const list = await db
      .select({
        id: coupons.id,
        code: coupons.code,
        description: coupons.description,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        minOrderAmount: coupons.minOrderAmount,
        maxUses: coupons.maxUses,
        usesCount: coupons.usesCount,
        startsAt: coupons.startsAt,
        expiresAt: coupons.expiresAt,
        organisationId: coupons.organisationId,
        orgName: organisations.name,
        isActive: coupons.isActive,
        createdAt: coupons.createdAt,
      })
      .from(coupons)
      .leftJoin(organisations, eq(coupons.organisationId, organisations.id))
      .where(isNull(coupons.deletedAt))
      .orderBy(desc(coupons.createdAt));

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/super-admin/coupons] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxUses,
      startsAt,
      expiresAt,
      organisationId,
      isActive,
    } = parsed.data;

    // Check if duplicate code exists
    const [existing] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, code), isNull(coupons.deletedAt)))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }

    const [coupon] = await db
      .insert(coupons)
      .values({
        code,
        description: description || null,
        discountType,
        discountValue: discountValue.toString(),
        minOrderAmount: minOrderAmount ? minOrderAmount.toString() : "0.00",
        maxUses: maxUses || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        organisationId: organisationId || null,
        isActive,
      })
      .returning();

    try {
      await logAction({
        userId: session!.user.id,
        role: session!.user.role,
        action: "CREATED_COUPON",
        entity: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code, discountType, discountValue },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error(`[api/super-admin/coupons] Audit log failed for coupon ${coupon.id}:`, auditErr);
    }

    return NextResponse.json(coupon, { status: 201 });
  } catch (err) {
    console.error("[api/super-admin/coupons] POST error:", err);
    const msg = err instanceof Error ? err.message : "Failed to create coupon";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const organisationId = session!.user.organisationId;
  if (!organisationId) {
    return NextResponse.json({ error: "Organisation not associated with this admin" }, { status: 400 });
  }

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
        isActive: coupons.isActive,
        createdAt: coupons.createdAt,
      })
      .from(coupons)
      .where(
        and(
          eq(coupons.organisationId, organisationId),
          isNull(coupons.deletedAt)
        )
      )
      .orderBy(desc(coupons.createdAt));

    return NextResponse.json(list);
  } catch (err) {
    console.error("[api/org-admin/coupons] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

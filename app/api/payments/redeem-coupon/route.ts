import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { coupons, liveCourses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  try {
    const body = await request.json();
    const { courseId, slotsCount, couponCode } = body as {
      courseId: string;
      slotsCount: number;
      couponCode: string;
    };

    if (!courseId || !slotsCount || !couponCode?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [course] = await db.select().from(liveCourses).where(eq(liveCourses.id, courseId)).limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const totalAmount = parseFloat(course.price) * slotsCount;

    // Fetch active and non-deleted coupon case-insensitively
    const [coupon] = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(sql`lower(${coupons.code})`, couponCode.trim().toLowerCase()),
          isNull(coupons.deletedAt)
        )
      )
      .limit(1);

    if (!coupon) {
      return NextResponse.json({ error: "Coupon code not found" }, { status: 400 });
    }

    if (!coupon.isActive) {
      return NextResponse.json({ error: "Coupon is inactive" }, { status: 400 });
    }

    const now = new Date();
    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      return NextResponse.json({ error: "Coupon has not started yet" }, { status: 400 });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });
    }

    if (coupon.maxUses !== null && (coupon.usesCount ?? 0) >= coupon.maxUses) {
      return NextResponse.json({ error: "Coupon use limit exceeded" }, { status: 400 });
    }

    // Check organization assignment
    if (coupon.organisationId && coupon.organisationId !== session!.user.organisationId) {
      return NextResponse.json({ error: "This coupon is not assigned to your organisation" }, { status: 400 });
    }

    const minOrder = parseFloat(coupon.minOrderAmount ?? "0.00");
    if (totalAmount < minOrder) {
      return NextResponse.json({ error: `Minimum order amount of ₹${minOrder} not met` }, { status: 400 });
    }

    let discountAmount = 0;
    const value = parseFloat(coupon.discountValue);
    if (coupon.discountType === "percent") {
      discountAmount = (totalAmount * value) / 100;
    } else {
      discountAmount = value;
    }

    // Clamp discount to total amount
    if (discountAmount > totalAmount) {
      discountAmount = totalAmount;
    }

    const finalAmount = totalAmount - discountAmount;

    return NextResponse.json({
      ok: true,
      couponId: coupon.id,
      code: coupon.code,
      discountAmount,
      finalAmount,
    });
  } catch (err) {
    console.error("[api/payments/redeem-coupon] POST error:", err);
    return NextResponse.json({ error: "Failed to validate coupon" }, { status: 500 });
  }
}

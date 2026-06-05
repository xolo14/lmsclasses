import { NextResponse } from "next/server";
import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, payments, coupons } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { buySlotsSchema } from "@/lib/validations";
import { getClientIp } from "@/lib/audit";
import { fulfillSlotPurchase } from "@/lib/payments-fulfill";
import {
  getRazorpayInstance,
  getRazorpayKeyId,
  getRazorpayKeySecret,
} from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = buySlotsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { courseId, slotsCount } = parsed.data;
    const couponCode = (body.couponCode as string | undefined)?.trim();
    const organisationId = session!.user.organisationId!;

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const rawTotal = parseFloat(course.price) * slotsCount;
    let finalAmount = rawTotal;
    let discountAmount = 0;
    let couponId: string | null = null;

    if (couponCode) {
      // Validate coupon code case-insensitively
      const [coupon] = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(sql`lower(${coupons.code})`, couponCode.toLowerCase()),
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
      if (coupon.organisationId && coupon.organisationId !== organisationId) {
        return NextResponse.json({ error: "This coupon is not assigned to your organisation" }, { status: 400 });
      }

      const minOrder = parseFloat(coupon.minOrderAmount ?? "0.00");
      if (rawTotal < minOrder) {
        return NextResponse.json({ error: `Minimum order amount of ₹${minOrder} not met` }, { status: 400 });
      }

      const value = parseFloat(coupon.discountValue);
      if (coupon.discountType === "percent") {
        discountAmount = (rawTotal * value) / 100;
      } else {
        discountAmount = value;
      }

      if (discountAmount > rawTotal) {
        discountAmount = rawTotal;
      }

      finalAmount = rawTotal - discountAmount;
      couponId = coupon.id;
    }

    const [payment] = await db
      .insert(payments)
      .values({
        organisationId,
        courseId,
        adminId: session!.user.id,
        amount: finalAmount.toString(),
        slotsCount,
        couponId,
        discountAmount: discountAmount > 0 ? discountAmount.toString() : null,
        status: "pending",
      })
      .returning();

    // Zero amount checkout path (e.g. 100% discount coupon applied)
    if (finalAmount === 0) {
      const result = await fulfillSlotPurchase(payment.id, {
        razorpayOrderId: `free_${payment.id}`,
        razorpayPaymentId: `free_pay_${Date.now()}`,
        userId: session!.user.id,
        role: session!.user.role,
        ipAddress: getClientIp(request),
      });

      if (!result.ok) {
        return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
      }

      return NextResponse.json({
        paymentId: payment.id,
        amount: 0,
        slotsCount,
        mock: true,
        zeroAmount: true,
        message: "Order placed for free via coupon discount!",
      });
    }

    const razorpay = getRazorpayInstance();
    const keyId = getRazorpayKeyId();

    if (!razorpay || !keyId || !getRazorpayKeySecret()) {
      if (process.env.NODE_ENV === "production") {
        await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
        return NextResponse.json(
          {
            error:
              "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json({
        paymentId: payment.id,
        amount: finalAmount,
        slotsCount,
        mock: true,
        message: "Razorpay not configured — dev mock mode only",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: payment.id,
    });

    await db
      .update(payments)
      .set({ razorpayOrderId: order.id })
      .where(eq(payments.id, payment.id));

    return NextResponse.json({
      paymentId: payment.id,
      orderId: order.id,
      amount: finalAmount,
      currency: "INR",
      key: keyId,
    });
  } catch (err) {
    console.error("[payments/create-order] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

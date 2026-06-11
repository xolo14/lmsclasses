import { NextResponse } from "next/server";
import { eq, and, sql, isNull, gte } from "drizzle-orm";
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
  try {
    const body = await request.json();

    if (body.source === "public") {
      const courseId = body.courseId as string | undefined;
      const amount = Number(body.amount);
      if (!courseId || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid course or amount" }, { status: 400 });
      }

      const [course] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.isActive, true), isNull(courses.deletedAt)))
        .limit(1);
      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const price = parseFloat(course.price);
      if (Math.abs(price - amount) > 0.01) {
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
      }

      const { createPublicOrder, getRazorpayKeyId } = await import("@/lib/razorpay");
      const order = await createPublicOrder(price, courseId);
      const keyId = getRazorpayKeyId();

      return NextResponse.json({
        orderId: order.id,
        amount: price,
        currency: order.currency,
        key: keyId,
      });
    }

    const { error, session } = await requireAuth(["org_admin"]);
    if (error) return error;

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

    // BUG FIX: idempotency — reuse pending order within 60s for same org+course+amount
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const [recentPending] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.organisationId, organisationId),
          eq(payments.courseId, courseId),
          eq(payments.status, "pending"),
          eq(payments.amount, finalAmount.toString()),
          gte(payments.createdAt, sixtySecondsAgo),
          isNull(payments.razorpayPaymentId)
        )
      )
      .limit(1);

    let payment = recentPending ?? null;
    if (!payment) {
      const inserted = await db
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
      payment = inserted[0] ?? null;
    }
    if (!payment) {
      return NextResponse.json({ error: "Failed to create payment record" }, { status: 500 });
    }

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
        zeroAmount: true,
        message: "Order placed for free via coupon discount!",
      });
    }

    const razorpay = getRazorpayInstance();
    const keyId = getRazorpayKeyId();

    if (!razorpay || !keyId || !getRazorpayKeySecret()) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
      return NextResponse.json(
        {
          error:
            "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.",
        },
        { status: 503 }
      );
    }

    let orderId = payment.razorpayOrderId;
    if (!orderId) {
      const order = await razorpay.orders.create({
        amount: Math.round(finalAmount * 100),
        currency: "INR",
        receipt: payment.id,
      });
      orderId = order.id;
      await db
        .update(payments)
        .set({ razorpayOrderId: orderId })
        .where(eq(payments.id, payment.id));
    }

    return NextResponse.json({
      paymentId: payment.id,
      orderId,
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

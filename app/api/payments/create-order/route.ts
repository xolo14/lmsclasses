import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, payments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { buySlotsSchema } from "@/lib/validations";
import { getRazorpayInstance, isRazorpayConfigured } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const body = await request.json();
  const parsed = buySlotsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { courseId, slotsCount } = parsed.data;
  const organisationId = session!.user.organisationId!;

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const amount = parseFloat(course.price) * slotsCount;

  const [payment] = await db
    .insert(payments)
    .values({
      organisationId,
      courseId,
      adminId: session!.user.id,
      amount: amount.toString(),
      slotsCount,
      status: "pending",
    })
    .returning();

  const razorpay = getRazorpayInstance();

  if (!razorpay || !isRazorpayConfigured()) {
    return NextResponse.json({
      paymentId: payment.id,
      amount,
      slotsCount,
      mock: true,
      message: "Razorpay not configured — use verify endpoint with mock flag",
    });
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
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
      amount,
      currency: "INR",
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
    console.error("[payments/create-order]", err);
    const message = err instanceof Error ? err.message : "Failed to create Razorpay order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

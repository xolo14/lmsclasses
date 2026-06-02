import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, slots } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { verifyRazorpaySignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const body = await request.json();
  const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, mock } = body;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.organisationId !== session!.user.organisationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!mock) {
    const isValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    if (!isValid) {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, paymentId));
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  await db
    .update(payments)
    .set({
      status: "success",
      razorpayOrderId: razorpayOrderId || payment.razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId || `mock_${Date.now()}`,
    })
    .where(eq(payments.id, paymentId));

  await db.insert(slots).values({
    organisationId: payment.organisationId,
    courseId: payment.courseId,
    totalSlots: payment.slotsCount,
    usedSlots: 0,
    paymentId: payment.id,
  });

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "PURCHASED_SLOTS",
    entity: "Payment",
    entityId: paymentId,
    metadata: { slotsCount: payment.slotsCount, courseId: payment.courseId },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp } from "@/lib/audit";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { fulfillSlotPurchase } from "@/lib/payments-fulfill";

export const runtime = "nodejs";

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

  if (payment.status === "success") {
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }

  if (mock) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Mock payments are disabled in production" },
        { status: 400 }
      );
    }
  } else {
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }
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

  const result = await fulfillSlotPurchase(paymentId, {
    razorpayOrderId: razorpayOrderId || payment.razorpayOrderId || "",
    razorpayPaymentId: razorpayPaymentId || `mock_${Date.now()}`,
    userId: session!.user.id,
    role: session!.user.role,
    ipAddress: getClientIp(request),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, alreadyProcessed: result.alreadyProcessed });
}

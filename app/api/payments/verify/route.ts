import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db, payments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp } from "@/lib/audit";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { fulfillSlotPurchase } from "@/lib/payments-fulfill";

export const runtime = "nodejs";

export async function POST(request: Request) {
 const { error, session } = await requireAuth(["org_admin"]);
 if (error) return error;

 const body = await request.json();
 const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

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

 if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
 return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
 }

 // Verify signature — do NOT mark failed on bad signature, webhook may still fulfill
 const isValid = verifyRazorpaySignature(
 razorpayOrderId,
 razorpayPaymentId,
 razorpaySignature
 );

 if (!isValid) {
 return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
 }

 // Atomic CAS: only claim pending/failed — webhook may have already fulfilled this payment
 const claimed = await db
 .update(payments)
 .set({
 status: "success",
 razorpayOrderId,
 razorpayPaymentId,
 })
 .where(
 and(
 eq(payments.id, paymentId),
 or(eq(payments.status, "pending"), eq(payments.status, "failed"))
 )
 )
 .returning();

 const claimedPayment = claimed[0];
 const wasNewClaim = !!claimedPayment;

 if (!claimedPayment) {
 const [recheck] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
 if (recheck?.status === "success") {
 return NextResponse.json({ success: true, alreadyProcessed: true });
 }
 return NextResponse.json({ error: "Payment is not pending" }, { status: 400 });
 }

 const result = await fulfillSlotPurchase(claimedPayment.id, {
 razorpayOrderId,
 razorpayPaymentId,
 userId: session!.user.id,
 role: session!.user.role,
 ipAddress: getClientIp(request),
 skipClaim: true,
 });

 if (!result.ok) {
 return NextResponse.json({ error: result.error }, { status: 400 });
 }

 return NextResponse.json({
 success: true,
 alreadyProcessed: !wasNewClaim || result.alreadyProcessed,
 });
}

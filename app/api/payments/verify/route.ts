import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { getClientIp } from "@/lib/audit";
import { verifyRazorpaySignature, verifyRazorpayPaymentMatches } from "@/lib/razorpay";
import { fulfillSlotPurchase } from "@/lib/payments-fulfill";
import { verifyPaymentSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(request: Request) {
 const { error, session } = await requireAuth(["org_admin"]);
 if (error) return error;

 const body = await request.json().catch(() => null);
 const parsed = verifyPaymentSchema.safeParse(body);
 if (!parsed.success) {
 return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
 }
 const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

 const organisationId = await resolveOrganisationId(session!);
 if (!organisationId) {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 const [payment] = await db
 .select()
 .from(payments)
 .where(eq(payments.id, paymentId))
 .limit(1);

 if (!payment) {
 return NextResponse.json({ error: "Payment not found" }, { status: 404 });
 }

 if (payment.organisationId !== organisationId) {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 if (payment.status === "success") {
 return NextResponse.json({ success: true, alreadyProcessed: true });
 }

 // The Razorpay order must be the one we created for this payment row — never
 // let a client swap in a different (cheaper) order that carries a valid signature.
 if (payment.razorpayOrderId && payment.razorpayOrderId !== razorpayOrderId) {
 return NextResponse.json({ error: "Order does not match payment" }, { status: 400 });
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

 // Source of truth: confirm with Razorpay that this payment is captured/authorized,
 // belongs to this order and is for the exact amount we expect. Fails closed on API errors.
 const match = await verifyRazorpayPaymentMatches({
 razorpayPaymentId,
 razorpayOrderId,
 expectedAmountRupees: payment.amount,
 });
 if (!match.ok) {
 return NextResponse.json({ error: match.reason }, { status: 400 });
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

 if (!claimedPayment) {
 const [recheck] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
 if (recheck?.status === "success") {
 return NextResponse.json({ success: true, alreadyProcessed: true });
 }
 return NextResponse.json({ error: "Payment is not pending" }, { status: 400 });
 }

 // We won the CAS — skipClaim tells fulfilment to treat our claim as the lock.
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
 alreadyProcessed: result.alreadyProcessed ?? false,
 needsManualReview: result.needsManualReview,
 });
}

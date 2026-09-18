import { NextResponse } from "next/server";
import {
 and,
 eq,
 or,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import {
 rupeesToPaise,
 verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import {
 findPaymentByRazorpayOrderId,
 fulfillSlotPurchase,
} from "@/lib/payments-fulfill";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
 event?: string;
 payload?: {
 payment?: {
 entity?: {
 id?: string;
 order_id?: string;
 status?: string;
 amount?: number | string;
 currency?: string;
 };
 };
 };
};

export async function POST(request: Request) {
 const rawBody = await request.text();
 const signature = request.headers.get("x-razorpay-signature");

 if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
 return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
 }

 let body: RazorpayWebhookPayload;
 try {
 body = JSON.parse(rawBody) as RazorpayWebhookPayload;
 } catch {
 return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
 }

 const event = body.event;

 // Handle payment.failed explicitly so failed payments don't stay in pending forever
 if (event === "payment.failed" || event === "order.failed") {
 const orderId = body.payload?.payment?.entity?.order_id;
 if (orderId) {
 const payment = await findPaymentByRazorpayOrderId(orderId);
 if (payment && payment.status === "pending") {
 await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
 }
 }
 return NextResponse.json({ received: true, ignored: "payment_failed" });
 }

 if (event !== "payment.captured" && event !== "order.paid") {
 return NextResponse.json({ received: true, ignored: event });
 }

 const paymentEntity = body.payload?.payment?.entity;
 const orderId = paymentEntity?.order_id;
 const razorpayPaymentId = paymentEntity?.id;

 if (!orderId || !razorpayPaymentId) {
 return NextResponse.json({ error: "Missing order or payment id" }, { status: 400 });
 }

 const payment = await findPaymentByRazorpayOrderId(orderId);
 if (!payment) {
 // Not an LMS org-slot payment (or timing-window purge removed it) — ACK so Razorpay stops retrying.
 return NextResponse.json({ received: true, ignored: "unknown_order" });
 }

 if (payment.status === "success") {
 return NextResponse.json({ received: true, alreadyProcessed: true });
 }

 // Bind the webhook's payment entity to our DB row: the order must be the one we stored
 // and the captured amount (paise) must equal what we charged for. Do NOT fulfil otherwise.
 const paidPaise = Number(paymentEntity?.amount);
 const expectedPaise = rupeesToPaise(payment.amount);
 const orderMismatch = payment.razorpayOrderId !== orderId;
 const amountMismatch = !Number.isFinite(paidPaise) || paidPaise !== expectedPaise;
 if (orderMismatch || amountMismatch) {
 console.error(
 `[payments/webhook] payment binding mismatch payment=${payment.id} order=${orderId} paid=${paidPaise} expected=${expectedPaise}`
 );
 await logAction({
 action: "PAYMENT_NEEDS_MANUAL_REVIEW",
 entity: "Payment",
 entityId: payment.id,
 metadata: {
 reason: orderMismatch ? "webhook_order_mismatch" : "webhook_amount_mismatch",
 actionTaken: "not_fulfilled",
 razorpayOrderId: orderId,
 razorpayPaymentId,
 paidPaise: Number.isFinite(paidPaise) ? paidPaise : null,
 expectedPaise,
 },
 });
 // ACK so Razorpay stops retrying — retrying cannot change the outcome; ops must review.
 return NextResponse.json({
 received: true,
 ignored: orderMismatch ? "order_mismatch" : "amount_mismatch",
 needsManualReview: true,
 });
 }

 // Atomic CAS: only accept pending/failed rows, skip already-successful (concurrent webhook handler got there first)
 const claimed = await db
 .update(payments)
 .set({
 status: "success",
 razorpayOrderId: orderId,
 razorpayPaymentId: razorpayPaymentId,
 })
 .where(
 and(
 eq(payments.id, payment.id),
 or(eq(payments.status, "pending"), eq(payments.status, "failed"))
 )
 )
 .returning();

 const claimedPayment = claimed[0];
 if (!claimedPayment) {
 // Already claimed by a concurrent handler — ACK idempotently
 const [recheck] = await db.select().from(payments).where(eq(payments.id, payment.id)).limit(1);
 if (recheck?.status === "success") {
 return NextResponse.json({ received: true, alreadyProcessed: true });
 }
 return NextResponse.json({ error: "Payment is not pending" }, { status: 400 });
 }

 const fulfillResult = await fulfillSlotPurchase(claimedPayment.id, {
 razorpayOrderId: orderId,
 razorpayPaymentId: razorpayPaymentId,
 skipClaim: true,
 });

 if (!fulfillResult.ok) {
 return NextResponse.json({ error: fulfillResult.error }, { status: 400 });
 }

 return NextResponse.json({
 success: true,
 alreadyProcessed: fulfillResult.alreadyProcessed,
 ignored: fulfillResult.ignored,
 needsManualReview: fulfillResult.needsManualReview,
 });
}

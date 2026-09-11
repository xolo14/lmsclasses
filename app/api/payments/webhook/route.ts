import { NextResponse } from "next/server";
import {
 and,
 eq,
 or,
} from "drizzle-orm";
import { db, payments } from "@/lib/db/schema";
import {
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

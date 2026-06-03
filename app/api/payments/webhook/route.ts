import { NextResponse } from "next/server";
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
  if (event !== "payment.captured" && event !== "order.paid") {
    return NextResponse.json({ received: true, ignored: event });
  }

  const paymentEntity = body.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id;
  const paymentId = paymentEntity?.id;

  if (!orderId || !paymentId) {
    return NextResponse.json({ error: "Missing order or payment id" }, { status: 400 });
  }

  const payment = await findPaymentByRazorpayOrderId(orderId);
  if (!payment) {
    return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
  }

  const result = await fulfillSlotPurchase(payment.id, {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, alreadyProcessed: result.alreadyProcessed });
}

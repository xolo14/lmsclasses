import Razorpay from "razorpay";
import crypto from "crypto";

function assertRazorpayEnv(): void {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required. Add them to .env.local."
    );
  }
}

/** Bump when payment/env behavior changes — visible at /api/health */
export const PAYMENTS_DEPLOY_VERSION = "razorpay-v4-public";

export function getRazorpayKeyId(): string | null {
  const id =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ||
    process.env.RAZORPAY_KEY_ID?.trim() ||
    "";
  return id || null;
}

export function getRazorpayKeySecret(): string | null {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
  return secret || null;
}

export function getRazorpayWebhookSecret(): string | null {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || "";
  return secret || null;
}

export function isRazorpayConfigured(): boolean {
  return !!(getRazorpayKeyId() && getRazorpayKeySecret());
}

export function getRazorpayInstance() {
  assertRazorpayEnv();
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;

  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expected === signature;
}

/** Alias used by public enrollment and payment verification flows */
export const verifySignature = verifyRazorpaySignature;

export type RazorpayOrderResult = {
  id: string;
  amount: number;
  currency: string;
};

export async function createPublicOrder(
  amount: number,
  courseId: string
): Promise<RazorpayOrderResult> {
  assertRazorpayEnv();
  const razorpay = getRazorpayInstance();
  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    notes: { source: "public", courseId },
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = getRazorpayWebhookSecret();
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expected === signature;
}

export function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function generateLmsId(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `LMS${num}`;
}

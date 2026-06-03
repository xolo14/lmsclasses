import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, slots } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import type { Role } from "@/lib/db/schema";

export async function fulfillSlotPurchase(
  paymentId: string,
  opts: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    userId?: string;
    role?: Role;
    ipAddress?: string | null;
  }
): Promise<{ ok: true; alreadyProcessed?: boolean } | { ok: false; error: string }> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) {
    return { ok: false, error: "Payment not found" };
  }

  if (payment.status === "success") {
    return { ok: true, alreadyProcessed: true };
  }

  await db
    .update(payments)
    .set({
      status: "success",
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
    })
    .where(eq(payments.id, paymentId));

  await db.insert(slots).values({
    organisationId: payment.organisationId,
    courseId: payment.courseId,
    totalSlots: payment.slotsCount,
    usedSlots: 0,
    paymentId: payment.id,
  });

  if (opts.userId && opts.role) {
    await logAction({
      userId: opts.userId,
      role: opts.role,
      action: "PURCHASED_SLOTS",
      entity: "Payment",
      entityId: paymentId,
      metadata: { slotsCount: payment.slotsCount, courseId: payment.courseId },
      ipAddress: opts.ipAddress ?? undefined,
    });
  }

  return { ok: true };
}

/** Find pending payment by Razorpay order id (order_xxx). */
export async function findPaymentByRazorpayOrderId(razorpayOrderId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, razorpayOrderId))
    .limit(1);
  return payment ?? null;
}

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, slots, coupons, organisations, courses, users } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import type { Role } from "@/lib/db/schema";
import { trySendWelcomeEmail, sendSlotPurchaseEmail } from "@/lib/email";

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

  if (payment.couponId) {
    await db
      .update(coupons)
      .set({
        usesCount: sql`COALESCE(${coupons.usesCount}, 0) + 1`
      })
      .where(eq(coupons.id, payment.couponId));
  }

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

  try {
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, payment.organisationId))
      .limit(1);

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, payment.courseId))
      .limit(1);

    if (org && course) {
      let adminEmail = org.email;
      let adminName = org.name + " Admin";

      if (org.adminId) {
        const [adminUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, org.adminId))
          .limit(1);
        if (adminUser) {
          adminEmail = adminUser.email;
          adminName = adminUser.name;
        }
      }

      if (adminEmail) {
        await trySendWelcomeEmail("slot purchase email", () =>
          sendSlotPurchaseEmail({
            email: adminEmail!,
            adminName,
            orgName: org.name,
            courseTitle: course.title,
            slotsCount: payment.slotsCount,
            amount: payment.amount,
            paymentId: payment.id,
          })
        );
      }
    }
  } catch (emailErr) {
    console.error("[FulfillPayment] Failed to send slot purchase email:", emailErr);
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

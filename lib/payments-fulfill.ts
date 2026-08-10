import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, slots, coupons, organisations, liveCourses, recordCourses, users } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import type { Role } from "@/lib/db/schema";
import { trySendWelcomeEmail, sendSlotPurchaseEmail } from "@/lib/email";
import { generatePaymentInvoice } from "@/lib/invoice";

export async function fulfillSlotPurchase(
  paymentId: string,
  opts: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    userId?: string;
    role?: Role;
    ipAddress?: string | null;
  }
): Promise<
  | { ok: true; alreadyProcessed?: boolean; ignored?: boolean; needsManualReview?: boolean }
  | { ok: false; error: string }
> {
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!existing) {
    return { ok: false, error: "Payment not found" };
  }

  if (existing.status === "success") {
    // Recover slots if a prior crash left success without a slot row
    await ensureSlotsForPayment(existing);
    return { ok: true, alreadyProcessed: true };
  }

  if (!existing.organisationId || !existing.adminId) {
    // Public / non-slot payments share this table — do not treat as failure for webhooks
    return { ok: true, ignored: true };
  }

  // Atomic claim: pending OR failed (failed may be a bad client verify that must not
  // block webhook fulfill after a real Razorpay capture).
  const claimed = await db
    .update(payments)
    .set({
      status: "success",
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
    })
    .where(
      and(
        eq(payments.id, paymentId),
        or(eq(payments.status, "pending"), eq(payments.status, "failed"))
      )
    )
    .returning();

  const payment = claimed[0];
  if (!payment) {
    const [again] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (again?.status === "success") {
      await ensureSlotsForPayment(again);
      return { ok: true, alreadyProcessed: true };
    }
    return { ok: false, error: "Payment is not pending" };
  }

  const organisationId = payment.organisationId!;
  let needsManualReview = false;

  if (payment.couponId) {
    // Hard-enforce maxUses: CAS increment must succeed when a limit is set
    const [coupon] = await db
      .select({ id: coupons.id, maxUses: coupons.maxUses, usesCount: coupons.usesCount })
      .from(coupons)
      .where(eq(coupons.id, payment.couponId))
      .limit(1);

    if (coupon?.maxUses != null) {
      const incremented = await db
        .update(coupons)
        .set({
          usesCount: sql`COALESCE(${coupons.usesCount}, 0) + 1`,
        })
        .where(
          and(
            eq(coupons.id, payment.couponId),
            sql`COALESCE(${coupons.usesCount}, 0) < ${coupons.maxUses}`
          )
        )
        .returning({ id: coupons.id });

      if (incremented.length === 0) {
        // Money already captured — still grant slots; flag for coupon oversell review.
        needsManualReview = true;
        console.error(
          `[FulfillPayment] coupon exhausted after capture; payment=${paymentId} granting_slots_needs_manual_review`
        );
        await logAction({
          action: "PAYMENT_NEEDS_MANUAL_REVIEW",
          entity: "Payment",
          entityId: paymentId,
          metadata: {
            reason: "coupon_max_uses_exhausted",
            actionTaken: "slots_granted_anyway",
            razorpayOrderId: opts.razorpayOrderId,
            razorpayPaymentId: opts.razorpayPaymentId,
          },
          ipAddress: opts.ipAddress ?? undefined,
        });
      }
    } else {
      await db
        .update(coupons)
        .set({
          usesCount: sql`COALESCE(${coupons.usesCount}, 0) + 1`,
        })
        .where(eq(coupons.id, payment.couponId));
    }
  }

  await ensureSlotsForPayment(payment);

  if (opts.userId && opts.role) {
    await logAction({
      userId: opts.userId,
      role: opts.role,
      action: "PURCHASED_SLOTS",
      entity: "Payment",
      entityId: paymentId,
      metadata: {
        slotsCount: payment.slotsCount,
        courseId: payment.liveCourseId ?? payment.recordCourseId,
        courseType: payment.liveCourseId ? "live" : "record",
        needsManualReview: needsManualReview || undefined,
      },
      ipAddress: opts.ipAddress ?? undefined,
    });
  }

  try {
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, organisationId))
      .limit(1);

    const [liveCourse] = payment.liveCourseId
      ? await db.select().from(liveCourses).where(eq(liveCourses.id, payment.liveCourseId)).limit(1)
      : [undefined];
    const [recordCourse] = payment.recordCourseId
      ? await db.select().from(recordCourses).where(eq(recordCourses.id, payment.recordCourseId)).limit(1)
      : [undefined];
    const course = liveCourse ?? recordCourse;

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
        let invoice: Awaited<ReturnType<typeof generatePaymentInvoice>> | null = null;
        try {
          invoice = await generatePaymentInvoice(paymentId, {
            customerName: adminName,
            orgName: org.name,
          });
        } catch (invoiceErr) {
          console.error("[FulfillPayment] invoice generation failed:", invoiceErr);
        }

        await trySendWelcomeEmail("slot purchase email", () =>
          sendSlotPurchaseEmail({
            email: adminEmail!,
            adminName,
            orgName: org.name,
            courseTitle: course.title,
            slotsCount: payment.slotsCount,
            amount: payment.amount,
            paymentId: payment.id,
            invoiceUrl: invoice?.absoluteUrl,
            invoiceAttachment: invoice
              ? { filename: invoice.filename, content: invoice.pdfBuffer }
              : undefined,
          })
        );
      }
    }
  } catch (emailErr) {
    console.error("[FulfillPayment] Failed to send slot purchase email:", emailErr);
  }

  return { ok: true, needsManualReview: needsManualReview || undefined };
}

async function ensureSlotsForPayment(payment: typeof payments.$inferSelect) {
  if (!payment.organisationId) return;

  const [existingSlot] = await db
    .select({ id: slots.id })
    .from(slots)
    .where(eq(slots.paymentId, payment.id))
    .limit(1);

  if (existingSlot) return;

  await db.insert(slots).values({
    organisationId: payment.organisationId,
    courseId: payment.liveCourseId ?? null,
    recordCourseId: payment.recordCourseId ?? null,
    totalSlots: payment.slotsCount,
    usedSlots: 0,
    paymentId: payment.id,
  });
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

/**
 * Repair success org-slot payments that somehow have no slots row,
 * and surface failed rows that still carry a Razorpay payment id.
 */
export async function reconcileStuckSlotPayments(): Promise<{
  slotsRepaired: number;
  failedWithPaymentId: number;
}> {
  const successOrgPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, "success"),
        isNotNull(payments.organisationId),
        isNotNull(payments.adminId)
      )
    )
    .limit(200);

  let slotsRepaired = 0;
  for (const payment of successOrgPayments) {
    const [existingSlot] = await db
      .select({ id: slots.id })
      .from(slots)
      .where(eq(slots.paymentId, payment.id))
      .limit(1);
    if (existingSlot) continue;

    await ensureSlotsForPayment(payment);
    slotsRepaired += 1;
    await logAction({
      action: "PAYMENT_SLOTS_RECONCILED",
      entity: "Payment",
      entityId: payment.id,
      metadata: { reason: "success_without_slots" },
    });
  }

  const [failedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(
      and(
        eq(payments.status, "failed"),
        isNotNull(payments.razorpayPaymentId),
        isNotNull(payments.organisationId)
      )
    );

  return {
    slotsRepaired,
    failedWithPaymentId: failedCount?.count ?? 0,
  };
}

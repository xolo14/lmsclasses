import { and, eq, sql } from "drizzle-orm";
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
    return { ok: true, alreadyProcessed: true };
  }

  if (!existing.organisationId || !existing.adminId) {
    // Public / non-slot payments share this table — do not treat as failure for webhooks
    return { ok: true, ignored: true };
  }

  // Atomic claim: only one concurrent fulfill wins
  const claimed = await db
    .update(payments)
    .set({
      status: "success",
      razorpayOrderId: opts.razorpayOrderId,
      razorpayPaymentId: opts.razorpayPaymentId,
    })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
    .returning();

  const payment = claimed[0];
  if (!payment) {
    const [again] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (again?.status === "success") {
      return { ok: true, alreadyProcessed: true };
    }
    return { ok: false, error: "Payment is not pending" };
  }

  const organisationId = payment.organisationId!;

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
        // Money already captured at Razorpay — keep payment success, skip slot credit,
        // and ACK webhooks so we don't retry-storm. Ops must review manually.
        console.error(
          `[FulfillPayment] coupon exhausted after capture; payment=${paymentId} needs_manual_review`
        );
        await logAction({
          action: "PAYMENT_NEEDS_MANUAL_REVIEW",
          entity: "Payment",
          entityId: paymentId,
          metadata: {
            reason: "coupon_max_uses_exhausted",
            razorpayOrderId: opts.razorpayOrderId,
            razorpayPaymentId: opts.razorpayPaymentId,
          },
          ipAddress: opts.ipAddress ?? undefined,
        });
        return {
          ok: true,
          needsManualReview: true,
          alreadyProcessed: false,
        };
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

  // Idempotent slots insert if a prior crash left payment=success without slots
  const [existingSlot] = await db
    .select({ id: slots.id })
    .from(slots)
    .where(eq(slots.paymentId, payment.id))
    .limit(1);

  if (!existingSlot) {
    await db.insert(slots).values({
      organisationId,
      courseId: payment.liveCourseId ?? null,
      recordCourseId: payment.recordCourseId ?? null,
      totalSlots: payment.slotsCount,
      usedSlots: 0,
      paymentId: payment.id,
    });
  }

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

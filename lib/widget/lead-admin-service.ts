import { createHmac, timingSafeEqual } from "crypto";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, recordCourses, widgetLeads } from "@/lib/db/schema";
import type { WidgetLead } from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import { getAppUrl, resolveRedirectUrl } from "@/lib/app-url";
import { createWidgetLeadOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { sendPaymentFailedFollowUpEmail } from "@/lib/email";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createStudentFromWidgetLead } from "@/lib/services/student-from-widget-lead";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { isTestKey } from "@/lib/api-key-service";

const FOLLOW_UP_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

function repaySecret(): string {
  return (
    process.env.WIDGET_REPAY_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "lms-widget-repay-dev"
  );
}

export function signRepayToken(leadId: string): string {
  return createHmac("sha256", repaySecret()).update(leadId).digest("hex").slice(0, 32);
}

export function verifyRepayToken(leadId: string, token: string): boolean {
  const expected = signRepayToken(leadId);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token.slice(0, 32)));
  } catch {
    return false;
  }
}

export function buildRepayUrl(leadId: string): string {
  const sig = signRepayToken(leadId);
  return `${getAppUrl()}/pay/${leadId}?sig=${sig}`;
}

export async function resendPaymentLink(
  leadId: string,
  options?: { actorUserId?: string; ipAddress?: string }
): Promise<{ paymentUrl: string }> {
  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (lead.convertedToStudent) throw new Error("Lead is already converted");

  const [course] = await db
    .select({ price: recordCourses.price, title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, lead.courseId))
    .limit(1);
  if (!course) throw new Error("Course not found");

  const price = parseFloat(course.price);
  const amountPaise = Math.round(price * 100);

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, lead.apiKeyId))
    .limit(1);

  let orderId = lead.razorpayOrderId;
  if (!isTestKey(apiKey ?? { environment: "live" }) && isRazorpayConfigured()) {
    const order = await createWidgetLeadOrder(price, {
      leadId: lead.id,
      courseId: lead.courseId,
      apiKeyId: lead.apiKeyId,
    });
    orderId = order.id;
  } else {
    orderId = `order_test_${lead.id.replace(/-/g, "").slice(0, 12)}`;
  }

  await db
    .update(widgetLeads)
    .set({
      razorpayOrderId: orderId,
      paymentStatus: "initiated",
      amountAttempted: amountPaise,
      updatedAt: new Date(),
    })
    .where(eq(widgetLeads.id, leadId));

  const paymentUrl = buildRepayUrl(leadId);

  await sendPaymentFailedFollowUpEmail({
    to: lead.email,
    name: lead.fullName,
    courseName: course.title,
    paymentUrl,
  });

  if (apiKey) {
    await logWidgetEvent({
      apiKey,
      eventType: "payment_link_resent",
      leadId: lead.id,
      metadata: { paymentUrl },
    });
  }

  await logAction({
    userId: options?.actorUserId,
    role: "super_admin",
    action: "WIDGET_PAYMENT_LINK_RESENT",
    entity: "WidgetLead",
    entityId: leadId,
    metadata: { paymentUrl },
    ipAddress: options?.ipAddress,
  });

  return { paymentUrl };
}

export async function manualConvertWidgetLead(
  leadId: string,
  options?: { actorUserId?: string; ipAddress?: string }
) {
  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (lead.convertedToStudent) throw new Error("Lead is already converted");

  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, lead.apiKeyId))
    .limit(1);

  await db
    .update(widgetLeads)
    .set({
      paymentStatus: "completed",
      status: "converted",
      updatedAt: new Date(),
    })
    .where(eq(widgetLeads.id, leadId));

  const [updated] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  const result = await createStudentFromWidgetLead(updated!, {
    apiKey: apiKey ?? undefined,
    ipAddress: options?.ipAddress,
  });

  await logAction({
    userId: options?.actorUserId,
    role: "super_admin",
    action: "WIDGET_LEAD_MANUAL_CONVERT",
    entity: "WidgetLead",
    entityId: leadId,
    metadata: { studentId: result.studentId },
    ipAddress: options?.ipAddress,
  });

  return result;
}

export async function updateWidgetLeadStatus(
  leadId: string,
  input: { status?: WidgetLead["status"]; adminNotes?: string | null },
  options?: { actorUserId?: string; ipAddress?: string }
) {
  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");

  const [updated] = await db
    .update(widgetLeads)
    .set({
      ...(input.status !== undefined && { status: input.status }),
      ...(input.adminNotes !== undefined && { adminNotes: input.adminNotes }),
      updatedAt: new Date(),
    })
    .where(eq(widgetLeads.id, leadId))
    .returning();

  await logAction({
    userId: options?.actorUserId,
    role: "super_admin",
    action: "WIDGET_LEAD_STATUS_UPDATED",
    entity: "WidgetLead",
    entityId: leadId,
    metadata: input,
    ipAddress: options?.ipAddress,
  });

  return updated;
}

export async function processDelayedFollowUpEmails(): Promise<number> {
  const cutoff = new Date(Date.now() - FOLLOW_UP_DELAY_MS);

  const leads = await db
    .select()
    .from(widgetLeads)
    .where(
      and(
        inArray(widgetLeads.paymentStatus, ["failed", "cancelled"]),
        isNull(widgetLeads.followUpEmailSentAt),
        lt(widgetLeads.createdAt, cutoff),
        eq(widgetLeads.convertedToStudent, false)
      )
    )
    .limit(50);

  let sent = 0;
  for (const lead of leads) {
    try {
      const paymentUrl = buildRepayUrl(lead.id);
      await sendPaymentFailedFollowUpEmail({
        to: lead.email,
        name: lead.fullName,
        courseName: lead.courseName,
        paymentUrl,
      });
      await db
        .update(widgetLeads)
        .set({ followUpEmailSentAt: new Date(), updatedAt: new Date() })
        .where(eq(widgetLeads.id, lead.id));
      sent++;
    } catch (err) {
      console.error("[widget-follow-up]", lead.id, err);
    }
  }
  return sent;
}

export async function getRepayCheckout(leadId: string, sig: string) {
  if (!verifyRepayToken(leadId, sig)) throw new Error("Invalid payment link");

  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (lead.convertedToStudent) throw new Error("Already enrolled");

  const [course] = await db
    .select({ price: recordCourses.price, title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, lead.courseId))
    .limit(1);
  if (!course) throw new Error("Course not found");

  const price = parseFloat(course.price);
  let orderId = lead.razorpayOrderId;

  if (!orderId || lead.paymentStatus !== "initiated") {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, lead.apiKeyId))
      .limit(1);

    if (isTestKey(apiKey ?? { environment: "live" })) {
      orderId = `order_test_${lead.id.replace(/-/g, "").slice(0, 12)}`;
    } else if (isRazorpayConfigured()) {
      const order = await createWidgetLeadOrder(price, {
        leadId: lead.id,
        courseId: lead.courseId,
        apiKeyId: lead.apiKeyId,
      });
      orderId = order.id;
    } else {
      throw new Error("Payment unavailable");
    }

    await db
      .update(widgetLeads)
      .set({
        razorpayOrderId: orderId,
        paymentStatus: "initiated",
        amountAttempted: Math.round(price * 100),
        updatedAt: new Date(),
      })
      .where(eq(widgetLeads.id, leadId));
  }

  return {
    leadId: lead.id,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    courseName: course.title,
    amount: Math.round(price * 100),
    currency: "INR",
    razorpayOrderId: orderId!,
    apiKeyId: lead.apiKeyId,
  };
}

export async function confirmRepayPayment(
  leadId: string,
  sig: string,
  input: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
) {
  if (!verifyRepayToken(leadId, sig)) throw new Error("Invalid payment link");

  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");

  const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.id, lead.apiKeyId)).limit(1);

  if (lead.convertedToStudent) {
    return { success: true, message: "Already enrolled", loginUrl: resolveRedirectUrl(apiKey?.redirectOnSuccess) };
  }

  if (!isTestKey(apiKey ?? { environment: "live" })) {
    if (!verifyRazorpaySignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
      throw new Error("Payment verification failed");
    }
  }

  await db
    .update(widgetLeads)
    .set({
      paymentStatus: "completed",
      razorpayPaymentId: input.razorpay_payment_id,
      razorpayOrderId: input.razorpay_order_id,
      updatedAt: new Date(),
    })
    .where(eq(widgetLeads.id, leadId));

  const [updated] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, leadId)).limit(1);
  const result = await createStudentFromWidgetLead(updated!, { apiKey: apiKey ?? undefined });

  if (apiKey) {
    await logWidgetEvent({
      apiKey,
      eventType: "payment_success",
      leadId,
      metadata: { source: "repay_link" },
    });
  }

  return {
    success: true,
    message: "Enrollment confirmed! Check your email for login details.",
    loginUrl: result.loginUrl ?? resolveRedirectUrl(apiKey?.redirectOnSuccess),
  };
}

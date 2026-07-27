import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses, widgetLeads } from "@/lib/db/schema";
import type { WidgetAuthContext } from "@/lib/widget/widget-auth";
import { widgetJson } from "@/lib/widget/widget-auth";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { YEAR_OF_STUDY_OPTIONS } from "@/lib/validations/widget";
import {
  createWidgetLeadOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from "@/lib/razorpay";
import { isTestKey } from "@/lib/api-key-service";
import { createStudentFromWidgetLead } from "@/lib/services/student-from-widget-lead";
import { resolveRedirectUrl } from "@/lib/app-url";

export type WidgetSubmitPayload = {
  fullName: string;
  email: string;
  phone: string;
  college?: string | null;
  yearOfStudy?: string | null;
  degree?: string | null;
  landingPageUrl?: string | null;
};

export type WidgetPaymentCallbackPayload = {
  leadId: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  status?: "failed" | "cancelled";
  error_description?: string | null;
};

export async function getWidgetEnrollConfig(ctx: WidgetAuthContext, request: Request) {
  if (!ctx.apiKey.courseId) {
    return widgetJson(
      ctx,
      request,
      { error: "INVALID_KEY", message: "API key is not linked to a course" },
      400
    );
  }

  const [course] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      price: recordCourses.price,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(eq(recordCourses.id, ctx.apiKey.courseId))
    .limit(1);

  if (!course || !course.isActive) {
    return widgetJson(
      ctx,
      request,
      { error: "COURSE_UNAVAILABLE", message: "Course is not available" },
      404
    );
  }

  const price = parseFloat(course.price);
  const razorpayKeyId = getRazorpayKeyId();

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "widget_loaded",
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
  });

  return widgetJson(ctx, request, {
    courseId: course.id,
    courseName: course.title,
    price,
    currency: "INR",
    razorpayKeyId,
    orgName: "LMS Classes",
    formConfig: {
      fields: ["fullName", "email", "phone", "college", "yearOfStudy", "degree"],
      yearOptions: YEAR_OF_STUDY_OPTIONS,
    },
  });
}

export async function processWidgetEnrollSubmit(
  ctx: WidgetAuthContext,
  data: WidgetSubmitPayload,
  request: Request
) {
  const courseId = ctx.apiKey.courseId;
  if (!courseId) {
    return widgetJson(
      ctx,
      request,
      { error: "INVALID_KEY", message: "API key is not linked to a course" },
      400
    );
  }

  const [course] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      price: recordCourses.price,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);

  if (!course || !course.isActive) {
    return widgetJson(ctx, request, { error: "COURSE_UNAVAILABLE", message: "Course unavailable" }, 404);
  }

  const price = parseFloat(course.price);
  const amountPaise = Math.round(price * 100);

  const [converted] = await db
    .select({ id: widgetLeads.id })
    .from(widgetLeads)
    .where(
      and(
        eq(widgetLeads.email, data.email),
        eq(widgetLeads.courseId, courseId),
        eq(widgetLeads.convertedToStudent, true)
      )
    )
    .limit(1);

  if (converted) {
    return widgetJson(ctx, request, {
      alreadyEnrolled: true,
      message: "You're already enrolled in this course",
    });
  }

  const [lead] = await db
    .insert(widgetLeads)
    .values({
      apiKeyId: ctx.apiKey.id,
      apiKeyName: ctx.apiKey.name,
      courseId: course.id,
      courseName: course.title,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone.replace(/\D/g, "").slice(-10),
      college: data.college ?? null,
      yearOfStudy: data.yearOfStudy ?? null,
      degree: data.degree ?? null,
      paymentStatus: "initiated",
      amountAttempted: amountPaise,
      landingPageUrl: data.landingPageUrl ?? null,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: request.headers.get("user-agent"),
    })
    .returning();

  let orderId: string;
  if (isTestKey(ctx.apiKey)) {
    orderId = `order_test_${lead.id.replace(/-/g, "").slice(0, 12)}`;
  } else {
    if (!isRazorpayConfigured() || !getRazorpayKeyId()) {
      return widgetJson(
        ctx,
        request,
        { error: "PAYMENT_UNAVAILABLE", message: "Payment is temporarily unavailable" },
        503
      );
    }
    const order = await createWidgetLeadOrder(price, {
      leadId: lead.id,
      courseId: course.id,
      apiKeyId: ctx.apiKey.id,
    });
    orderId = order.id;
  }

  await db
    .update(widgetLeads)
    .set({ razorpayOrderId: orderId, updatedAt: new Date() })
    .where(eq(widgetLeads.id, lead.id));

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "form_submitted",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
  });
  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "payment_initiated",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
    metadata: { orderId },
  });

  return widgetJson(
    ctx,
    request,
    {
      leadId: lead.id,
      razorpayOrderId: orderId,
      amount: amountPaise,
      currency: "INR",
      courseName: course.title,
      razorpayKeyId: getRazorpayKeyId(),
    },
    201
  );
}

export async function processWidgetPaymentCallback(
  ctx: WidgetAuthContext,
  data: WidgetPaymentCallbackPayload,
  request: Request
) {
  const [lead] = await db
    .select()
    .from(widgetLeads)
    .where(and(eq(widgetLeads.id, data.leadId), eq(widgetLeads.apiKeyId, ctx.apiKey.id)))
    .limit(1);

  if (!lead) {
    return widgetJson(ctx, request, { error: "NOT_FOUND", message: "Lead not found" }, 404);
  }

  const failureStatus = data.status;
  if (failureStatus === "failed" || failureStatus === "cancelled") {
    // Never downgrade a completed payment (out-of-order client callbacks)
    if (lead.paymentStatus === "completed") {
      const redirectPath = ctx.apiKey.redirectOnSuccess ?? "/login";
      return widgetJson(ctx, request, {
        success: true,
        redirectUrl: resolveRedirectUrl(redirectPath),
        message: "Enrollment already confirmed.",
      });
    }

    await db
      .update(widgetLeads)
      .set({
        paymentStatus: failureStatus,
        failureReason: data.error_description ?? failureStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(widgetLeads.id, lead.id),
          // Only allow initiated → failed/cancelled
          eq(widgetLeads.paymentStatus, "initiated")
        )
      );

    await logWidgetEvent({
      apiKey: ctx.apiKey,
      eventType: failureStatus === "cancelled" ? "payment_cancelled" : "payment_failed",
      leadId: lead.id,
      ipAddress: ctx.ipAddress,
      domain: ctx.domain,
      metadata: { reason: data.error_description },
    });

    const redirectOnFailure = ctx.apiKey.redirectOnFailure;
    const redirectUrl = redirectOnFailure ? resolveRedirectUrl(redirectOnFailure, "/") : null;

    return widgetJson(ctx, request, {
      success: false,
      redirectUrl,
      message:
        "Payment didn't go through. Our team will reach out to help you complete enrollment.",
    });
  }

  const payId = data.razorpay_payment_id;
  const orderId = data.razorpay_order_id;
  const signature = data.razorpay_signature;

  if (!payId || !orderId || !signature) {
    return widgetJson(
      ctx,
      request,
      { error: "VALIDATION_FAILED", message: "Payment verification fields required" },
      422
    );
  }

  if (lead.paymentStatus === "completed" && lead.convertedToStudent) {
    const redirectPath = ctx.apiKey.redirectOnSuccess ?? "/login";
    return widgetJson(ctx, request, {
      success: true,
      redirectUrl: resolveRedirectUrl(redirectPath),
      message: "Enrollment already confirmed.",
    });
  }

  if (!isTestKey(ctx.apiKey) && !verifyRazorpaySignature(orderId, payId, signature)) {
    return widgetJson(
      ctx,
      request,
      { error: "PAYMENT_INVALID", message: "Payment verification failed" },
      400
    );
  }

  // Bind confirm to the order that was created for this lead
  if (lead.razorpayOrderId && lead.razorpayOrderId !== orderId) {
    return widgetJson(
      ctx,
      request,
      {
        error: "PAYMENT_INVALID",
        message: "Order does not match this lead's payment order",
      },
      400
    );
  }

  // Validate against the locked amount at order time — not the mutable course price
  if (!lead.amountAttempted || lead.amountAttempted <= 0) {
    return widgetJson(
      ctx,
      request,
      { error: "PAYMENT_INVALID", message: "Lead has no locked payment amount" },
      400
    );
  }

  await db
    .update(widgetLeads)
    .set({
      paymentStatus: "completed",
      razorpayPaymentId: payId,
      razorpayOrderId: orderId,
      updatedAt: new Date(),
    })
    .where(eq(widgetLeads.id, lead.id));

  const [updatedLead] = await db
    .select()
    .from(widgetLeads)
    .where(eq(widgetLeads.id, lead.id))
    .limit(1);

  let studentCreated = !!updatedLead?.convertedToStudent;
  let conversionError: string | null = null;
  if (ctx.apiKey.autoCreateStudent && !studentCreated) {
    try {
      await createStudentFromWidgetLead(updatedLead!, {
        ipAddress: ctx.ipAddress,
        apiKey: ctx.apiKey,
      });
      studentCreated = true;
    } catch (err) {
      conversionError = err instanceof Error ? err.message : "Student creation failed";
      console.error("[widget/payment-callback] student creation failed:", err);
      await db
        .update(widgetLeads)
        .set({
          adminNotes: `Auto-convert failed after payment: ${conversionError}`,
          updatedAt: new Date(),
        })
        .where(eq(widgetLeads.id, lead.id));
    }
  }

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "payment_success",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
    metadata: { studentCreated, conversionError },
  });

  const redirectPath = ctx.apiKey.redirectOnSuccess ?? "/login";
  const redirectUrl = resolveRedirectUrl(redirectPath);

  return widgetJson(ctx, request, {
    success: true,
    redirectUrl,
    studentCreated,
    message: studentCreated
      ? "Enrollment confirmed! Check your email for login details."
      : ctx.apiKey.autoCreateStudent
        ? "Payment received. Our team will finish your enrollment shortly."
        : "Payment confirmed.",
  });
}

/** Same-origin hosted form responses (no CORS wrapper). */
export function hostedEnrollJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function getHostedEnrollConfig(ctx: WidgetAuthContext, request: Request) {
  const response = await getWidgetEnrollConfig(ctx, request);
  const json = await response.json();
  return hostedEnrollJson(json, response.status);
}

export async function processHostedEnrollSubmit(
  ctx: WidgetAuthContext,
  data: WidgetSubmitPayload,
  request: Request
) {
  const response = await processWidgetEnrollSubmit(ctx, data, request);
  const json = await response.json();
  return hostedEnrollJson(json, response.status);
}

export async function processHostedPaymentCallback(
  ctx: WidgetAuthContext,
  data: WidgetPaymentCallbackPayload,
  request: Request
) {
  const response = await processWidgetPaymentCallback(ctx, data, request);
  const json = await response.json();
  return hostedEnrollJson(json, response.status);
}

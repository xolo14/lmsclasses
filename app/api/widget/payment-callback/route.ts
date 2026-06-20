import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses, widgetLeads } from "@/lib/db/schema";
import { resolveWidgetApiKey, widgetJson } from "@/lib/widget/widget-auth";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { widgetOptionsResponse } from "@/lib/widget/widget-cors";
import { widgetPaymentCallbackSchema } from "@/lib/validations/widget";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createStudentFromWidgetLead } from "@/lib/services/student-from-widget-lead";
import { getAppUrl } from "@/lib/app-url";
import { isTestKey } from "@/lib/api-key-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  const auth = await resolveWidgetApiKey(null, request, { checkDomain: false });
  return widgetOptionsResponse(auth.context?.apiKey ?? null, request);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = widgetPaymentCallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", message: "Invalid callback payload" },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const auth = await resolveWidgetApiKey(data.key, request);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

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
    await db
      .update(widgetLeads)
      .set({
        paymentStatus: failureStatus,
        failureReason: data.error_description ?? failureStatus,
        updatedAt: new Date(),
      })
      .where(eq(widgetLeads.id, lead.id));

    await logWidgetEvent({
      apiKey: ctx.apiKey,
      eventType: failureStatus === "cancelled" ? "payment_cancelled" : "payment_failed",
      leadId: lead.id,
      ipAddress: ctx.ipAddress,
      domain: ctx.domain,
      metadata: { reason: data.error_description },
    });

    const redirectOnFailure = ctx.apiKey.redirectOnFailure;
    const redirectUrl = redirectOnFailure
      ? redirectOnFailure.startsWith("http")
        ? redirectOnFailure
        : `${getAppUrl()}${redirectOnFailure}`
      : null;

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
    const redirectUrl =
      redirectPath.startsWith("http://") || redirectPath.startsWith("https://")
        ? redirectPath
        : `${getAppUrl()}${redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`}`;
    return widgetJson(ctx, request, {
      success: true,
      redirectUrl,
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

  const [course] = await db
    .select({ price: recordCourses.price })
    .from(recordCourses)
    .where(eq(recordCourses.id, lead.courseId))
    .limit(1);

  const expectedPaise = course ? Math.round(parseFloat(course.price) * 100) : lead.amountAttempted;
  if (expectedPaise && lead.amountAttempted && expectedPaise !== lead.amountAttempted) {
    return widgetJson(
      ctx,
      request,
      { error: "PAYMENT_INVALID", message: "Amount mismatch" },
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

  await createStudentFromWidgetLead(updatedLead!, {
    ipAddress: ctx.ipAddress,
    apiKey: ctx.apiKey,
  });

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "payment_success",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
  });

  const redirectPath = ctx.apiKey.redirectOnSuccess ?? "/login";
  const redirectUrl =
    redirectPath.startsWith("http://") || redirectPath.startsWith("https://")
      ? redirectPath
      : `${getAppUrl()}${redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`}`;

  return widgetJson(ctx, request, {
    success: true,
    redirectUrl,
    message: "Enrollment confirmed! Check your email for login details.",
  });
}

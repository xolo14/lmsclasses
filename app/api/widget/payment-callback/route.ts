import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { widgetLeads } from "@/lib/db/schema";
import { resolveWidgetApiKey, widgetJson } from "@/lib/widget/widget-auth";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { widgetOptionsResponse } from "@/lib/widget/widget-cors";
import { widgetPaymentCallbackSchema } from "@/lib/validations/widget";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { createStudentFromWidgetLead } from "@/lib/services/student-from-widget-lead";
import { resolveRedirectUrl } from "@/lib/app-url";
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

  // CAS: claim completed only from initiated (or retry after failed convert while already completed)
  if (lead.paymentStatus !== "completed") {
    const claimed = await db
      .update(widgetLeads)
      .set({
        paymentStatus: "completed",
        razorpayPaymentId: payId,
        razorpayOrderId: orderId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(widgetLeads.id, lead.id),
          inArray(widgetLeads.paymentStatus, ["initiated", "failed", "cancelled"])
        )
      )
      .returning({ id: widgetLeads.id });

    if (claimed.length === 0) {
      const [again] = await db
        .select()
        .from(widgetLeads)
        .where(eq(widgetLeads.id, lead.id))
        .limit(1);
      if (again?.paymentStatus === "completed" && again.convertedToStudent) {
        const redirectPath = ctx.apiKey.redirectOnSuccess ?? "/login";
        return widgetJson(ctx, request, {
          success: true,
          redirectUrl: resolveRedirectUrl(redirectPath),
          message: "Enrollment already confirmed.",
        });
      }
      if (again?.paymentStatus !== "completed") {
        return widgetJson(
          ctx,
          request,
          { error: "PAYMENT_INVALID", message: "Payment could not be confirmed for this lead" },
          409
        );
      }
    }
  } else {
    await db
      .update(widgetLeads)
      .set({
        razorpayPaymentId: payId,
        razorpayOrderId: orderId,
        updatedAt: new Date(),
      })
      .where(eq(widgetLeads.id, lead.id));
  }

  const [updatedLead] = await db
    .select()
    .from(widgetLeads)
    .where(eq(widgetLeads.id, lead.id))
    .limit(1);

  let studentCreated = false;
  let conversionError: string | null = null;
  if (ctx.apiKey.autoCreateStudent) {
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

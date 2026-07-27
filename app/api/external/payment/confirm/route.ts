import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { externalPaymentConfirmSchema } from "@/lib/validations/partner-lead";
import { createStudentFromLead } from "@/lib/partner-student-service";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { notifyPartnerWebhook } from "@/lib/partner-webhook";
import { logAction } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/payment/confirm";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "confirm_payment", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalPaymentConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed(
          Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? "invalid"])
          )
        ),
        { requestBody: body }
      );
    }

    const {
      leadId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      paymentId,
      amount,
      currency,
      paymentGateway,
    } = parsed.data;

    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
    if (!lead || lead.apiKeyId !== ctx.apiKey.id) {
      return finishApiKeyRequest(ctx, ENDPOINT, ApiKeyErrors.notFound("Lead"), { requestBody: body });
    }

    if (lead.paymentStatus === "completed") {
      // Allow retry until student is created when auto-create is on
      if (ctx.apiKey.autoCreateStudent && !lead.studentCreated) {
        let studentResult: Awaited<ReturnType<typeof createStudentFromLead>> | null = null;
        try {
          studentResult = await createStudentFromLead(lead, {
            ipAddress: ctx.ipAddress,
            apiKey: ctx.apiKey,
          });
        } catch (err) {
          console.error("[external/payment/confirm] student retry failed:", err);
          return finishApiKeyRequest(
            ctx,
            ENDPOINT,
            NextResponse.json(
              {
                error: "STUDENT_CREATE_FAILED",
                message: err instanceof Error ? err.message : "Student creation failed",
                leadId,
                studentCreated: false,
              },
              { status: 500 }
            ),
            { requestBody: body, leadId }
          );
        }
        const [finalLead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
        const response = NextResponse.json({
          success: true,
          message: "Payment was already confirmed. Student account created on retry.",
          leadId,
          studentCreated: true,
          loginUrl: studentResult?.loginUrl ?? `${getAppUrl()}/login`,
          studentUsername: finalLead?.studentUsername ?? studentResult?.username ?? null,
          ...(studentResult?.lmsId ? { lmsId: studentResult.lmsId } : {}),
        });
        return finishApiKeyRequest(ctx, ENDPOINT, response, { requestBody: body, leadId });
      }

      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          { error: "PAYMENT_ALREADY_PROCESSED", message: `Payment already ${lead.paymentStatus}` },
          { status: 409 }
        ),
        { requestBody: body, leadId }
      );
    }

    if (lead.paymentStatus !== "pending" && lead.paymentStatus !== "initiated") {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          { error: "PAYMENT_ALREADY_PROCESSED", message: `Payment already ${lead.paymentStatus}` },
          { status: 409 }
        ),
        { requestBody: body, leadId }
      );
    }

    const gateway = paymentGateway ?? "razorpay";
    const allowedGateway = ctx.apiKey.allowedPaymentGateway ?? "any";
    if (allowedGateway !== "any" && allowedGateway !== gateway) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.permissionDenied(`payment gateway ${gateway}`),
        { requestBody: body, leadId }
      );
    }

    // Manual/offline confirm is only allowed when the API key is explicitly set to "manual"
    // (not "any"), so a compromised key with default "any" cannot mark unpaid leads as paid.
    if (gateway === "manual" && allowedGateway !== "manual") {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.permissionDenied(
          "manual payment confirm requires allowedPaymentGateway=manual on this API key"
        ),
        { requestBody: body, leadId }
      );
    }

    const expectedPaise = lead.courseFee
      ? Math.round(parseFloat(lead.courseFee) * 100)
      : null;
    if (expectedPaise && amount !== expectedPaise) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.paymentInvalid(
          `Amount mismatch. Expected ${expectedPaise} paise, got ${amount}`
        ),
        { requestBody: body, leadId }
      );
    }

    if (gateway === "razorpay") {
      const payId = razorpayPaymentId ?? paymentId;
      const orderId = razorpayOrderId;
      const signature = razorpaySignature;
      if (!payId || !orderId || !signature) {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          ApiKeyErrors.validationFailed({
            razorpay: "razorpayPaymentId, razorpayOrderId, and razorpaySignature required",
          }),
          { requestBody: body, leadId }
        );
      }
      if (lead.paymentOrderId && lead.paymentOrderId !== orderId) {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          ApiKeyErrors.paymentInvalid("Order does not match this lead's payment order"),
          { requestBody: body, leadId }
        );
      }
      if (!verifyRazorpaySignature(orderId, payId, signature)) {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          ApiKeyErrors.paymentInvalid("Razorpay signature verification failed"),
          { requestBody: body, leadId }
        );
      }
    } else if (gateway !== "manual") {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed({ paymentGateway: "Unsupported payment gateway" }),
        { requestBody: body, leadId }
      );
    }

    const now = new Date();
    const claimed = await db
      .update(partnerLeads)
      .set({
        paymentStatus: "completed",
        paymentId: razorpayPaymentId ?? paymentId ?? null,
        paymentOrderId: razorpayOrderId ?? null,
        amountPaidPaise: amount,
        paymentCurrency: currency,
        paymentGateway: gateway,
        paymentConfirmedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(partnerLeads.id, leadId),
          inArray(partnerLeads.paymentStatus, ["pending", "initiated"])
        )
      )
      .returning({ id: partnerLeads.id });

    if (claimed.length === 0) {
      const [again] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
      if (again?.paymentStatus === "completed") {
        // Another concurrent confirm won — retry student create path below if needed
      } else {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          NextResponse.json(
            { error: "PAYMENT_ALREADY_PROCESSED", message: `Payment already ${again?.paymentStatus ?? "unknown"}` },
            { status: 409 }
          ),
          { requestBody: body, leadId }
        );
      }
    }

    const [updated] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);

    let studentCreated = updated!.studentCreated;
    let studentResult: Awaited<ReturnType<typeof createStudentFromLead>> | null = null;
    if (ctx.apiKey.autoCreateStudent && !studentCreated) {
      try {
        studentResult = await createStudentFromLead(updated!, {
          ipAddress: ctx.ipAddress,
          apiKey: ctx.apiKey,
        });
        studentCreated = true;
      } catch (err) {
        console.error("[external/payment/confirm] student create failed:", err);
        // Payment stays completed — client can retry confirm to finish student creation
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          NextResponse.json(
            {
              success: true,
              message:
                "Payment confirmed, but student account creation failed. Retry confirm to create the student.",
              leadId,
              studentCreated: false,
              error: err instanceof Error ? err.message : "Student creation failed",
            },
            { status: 200 }
          ),
          { requestBody: body, leadId }
        );
      }
    }

    const [finalLead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
    const loginUrl = studentResult?.loginUrl ?? `${getAppUrl()}/login`;
    const studentUsername = finalLead?.studentUsername ?? studentResult?.username ?? null;
    const lmsId = studentResult?.lmsId ?? null;

    if (ctx.apiKey.notifyWebhook) {
      notifyPartnerWebhook(ctx.apiKey, "payment.completed", finalLead ?? updated!).catch(console.error);
    }

    await logAction({
      action: "EXTERNAL_PAYMENT_CONFIRMED",
      entity: "PartnerLead",
      entityId: leadId,
      metadata: { amount, currency, apiKeyId: ctx.apiKey.id, studentCreated },
      ipAddress: ctx.ipAddress,
    });

    const emailPending = studentCreated && studentResult && !studentResult.emailSent;
    const response = NextResponse.json({
      success: true,
      message: emailPending
        ? "Payment confirmed. Student account is ready — redirect using loginUrl."
        : studentResult?.emailSent
          ? "Payment confirmed. Credentials have been emailed to the student."
          : "Payment confirmed.",
      leadId,
      studentCreated,
      loginUrl,
      studentUsername,
      ...(lmsId ? { lmsId } : {}),
    });
    return finishApiKeyRequest(ctx, ENDPOINT, response, { requestBody: body, leadId });
  } catch (err) {
    console.error("[external/payment/confirm] POST:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

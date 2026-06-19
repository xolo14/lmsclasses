import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest, isTestKey } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { externalPaymentCreateOrderSchema } from "@/lib/validations/partner-lead";
import { resolveCourseByName } from "@/lib/partner-course-service";
import { courseAllowed } from "@/lib/api-key-service";
import {
  createPartnerLeadOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
} from "@/lib/razorpay";
import { logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/payment/create-order";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "create_payment_order", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalPaymentCreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed({ leadId: "Valid leadId required" }),
        { requestBody: body }
      );
    }

    const { leadId } = parsed.data;
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
    if (!lead || lead.apiKeyId !== ctx.apiKey.id) {
      return finishApiKeyRequest(ctx, ENDPOINT, ApiKeyErrors.notFound("Lead"), { requestBody: body });
    }

    if (lead.paymentStatus === "completed") {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          { error: "PAYMENT_ALREADY_PROCESSED", message: "Payment already completed for this lead" },
          { status: 409 }
        ),
        { requestBody: body, leadId }
      );
    }

    let recordCourseId = lead.recordCourseId;
    let courseFee = lead.courseFee ? parseFloat(lead.courseFee) : null;

    if (!recordCourseId || !courseFee) {
      const resolved = await resolveCourseByName(lead.course);
      if (!resolved) {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          ApiKeyErrors.notFound(`Course "${lead.course}"`),
          { requestBody: body, leadId }
        );
      }
      recordCourseId = resolved.id;
      courseFee = resolved.price;
      await db
        .update(partnerLeads)
        .set({
          recordCourseId: resolved.id,
          courseSlug: resolved.slug,
          courseFee: resolved.price.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(partnerLeads.id, leadId));
    }

    if (!courseAllowed(ctx.apiKey, lead.course)) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.permissionDenied(`course "${lead.course}"`),
        { requestBody: body, leadId }
      );
    }

    const allowedGateway = ctx.apiKey.allowedPaymentGateway ?? "any";
    if (allowedGateway !== "any" && allowedGateway !== "razorpay") {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.permissionDenied("payment gateway razorpay"),
        { requestBody: body, leadId }
      );
    }

    const amountPaise = Math.round(courseFee * 100);
    let orderId: string;

    if (isTestKey(ctx.apiKey)) {
      orderId = `order_test_${leadId.replace(/-/g, "").slice(0, 12)}`;
    } else {
      if (!isRazorpayConfigured()) {
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          NextResponse.json(
            { error: "PAYMENT_UNAVAILABLE", message: "Razorpay is not configured" },
            { status: 503 }
          ),
          { requestBody: body, leadId }
        );
      }

      const order = await createPartnerLeadOrder(courseFee, {
        leadId,
        courseId: recordCourseId,
        apiKeyId: ctx.apiKey.id,
      });
      orderId = order.id;
    }

    const now = new Date();
    await db
      .update(partnerLeads)
      .set({
        paymentStatus: "initiated",
        paymentOrderId: orderId,
        paymentGateway: "razorpay",
        updatedAt: now,
      })
      .where(eq(partnerLeads.id, leadId));

    await logAction({
      action: "EXTERNAL_PAYMENT_ORDER_CREATED",
      entity: "PartnerLead",
      entityId: leadId,
      metadata: { orderId, amountPaise, apiKeyId: ctx.apiKey.id },
      ipAddress: ctx.ipAddress,
    });

    const keyId = getRazorpayKeyId();
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({
        orderId,
        amount: courseFee,
        amountPaise,
        currency: "INR",
        key: keyId,
        leadId,
        courseId: recordCourseId,
      }),
      { requestBody: body, leadId }
    );
  } catch (err) {
    console.error("[external/payment/create-order] POST:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

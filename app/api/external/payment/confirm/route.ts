import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { externalPaymentConfirmSchema } from "@/lib/validations/partner-lead";
import { createStudentFromLead } from "@/lib/partner-student-service";
import { logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "POST /api/external/payment/confirm";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "confirm_payment", ENDPOINT);
  if (auth.error) return auth.error;

  const { apiKey, ipAddress } = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalPaymentConfirmSchema.safeParse(body);
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
      return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
    }

    const { leadId, paymentId, amount, currency, paymentGateway } = parsed.data;

    const [lead] = await db
      .select()
      .from(partnerLeads)
      .where(eq(partnerLeads.id, leadId))
      .limit(1);

    if (!lead || lead.apiKeyId !== apiKey.id) {
      const response = NextResponse.json({ error: "Lead not found" }, { status: 404 });
      return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
    }

    if (lead.paymentStatus !== "pending") {
      const response = NextResponse.json(
        { error: `Payment already ${lead.paymentStatus}` },
        { status: 409 }
      );
      return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
    }

    await db
      .update(partnerLeads)
      .set({
        paymentStatus: "completed",
        paymentId,
        paymentAmount: amount.toFixed(2),
        paymentCurrency: currency,
        paymentGateway,
        updatedAt: new Date(),
      })
      .where(eq(partnerLeads.id, leadId));

    const [updated] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);

    if (!updated!.studentCreated) {
      await createStudentFromLead(updated!, { ipAddress });
    }

    await logAction({
      action: "EXTERNAL_PAYMENT_CONFIRMED",
      entity: "PartnerLead",
      entityId: leadId,
      metadata: { paymentId, amount, currency, apiKeyId: apiKey.id },
      ipAddress,
    });

    const response = NextResponse.json({
      success: true,
      message: "Payment confirmed, student credentials sent",
    });
    return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
  } catch (err) {
    console.error("[api/external/payment/confirm] POST:", err);
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
  }
}

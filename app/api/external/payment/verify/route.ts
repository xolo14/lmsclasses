import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { externalPaymentVerifySchema } from "@/lib/validations/partner-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/payment/verify";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "verify_payment", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalPaymentVerifySchema.safeParse(body);
    if (!parsed.success) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed({ leadId: "Valid leadId required" }),
        { requestBody: body }
      );
    }

    const [lead] = await db
      .select()
      .from(partnerLeads)
      .where(eq(partnerLeads.id, parsed.data.leadId))
      .limit(1);

    if (!lead || lead.apiKeyId !== ctx.apiKey.id) {
      return finishApiKeyRequest(ctx, ENDPOINT, ApiKeyErrors.notFound("Lead"), { requestBody: body });
    }

    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({
        leadId: lead.id,
        paymentStatus: lead.paymentStatus,
        amountPaid: lead.amountPaidPaise ?? null,
        paymentId: lead.paymentId,
        studentCreated: lead.studentCreated,
      }),
      { requestBody: body, leadId: lead.id }
    );
  } catch (err) {
    console.error("[external/payment/verify] POST:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

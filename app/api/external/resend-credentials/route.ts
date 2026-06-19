import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { externalResendCredentialsSchema } from "@/lib/validations/partner-lead";
import { resendPartnerStudentCredentials } from "@/lib/partner-student-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/resend-credentials";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "resend_credentials", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalResendCredentialsSchema.safeParse(body);
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

    if (!lead.studentCreated) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          { error: "STUDENT_NOT_CREATED", message: "Student not created yet" },
          { status: 400 }
        ),
        { requestBody: body, leadId: lead.id }
      );
    }

    await resendPartnerStudentCredentials(lead.id, {
      ipAddress: ctx.ipAddress,
      apiKey: ctx.apiKey,
    });

    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({
        success: true,
        message: `Credentials resent to ${lead.email}`,
      }),
      { requestBody: body, leadId: lead.id }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[external/resend-credentials] POST:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: msg }, { status: 500 })
    );
  }
}

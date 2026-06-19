import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { UPDATABLE_LEAD_FIELDS } from "@/lib/partner-lead-validation";
import { serializeLeadStatus } from "@/lib/partner-lead-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const endpoint = "/api/external/leads/:leadId";
  const auth = await requireApiKey(request, "get_lead_status", endpoint);
  if (auth.error) return auth.error;
  const ctx = auth.context!;
  const { leadId } = await params;

  try {
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
    if (!lead || lead.apiKeyId !== ctx.apiKey.id) {
      return finishApiKeyRequest(ctx, endpoint, ApiKeyErrors.notFound("Lead"));
    }
    return finishApiKeyRequest(ctx, endpoint, NextResponse.json(serializeLeadStatus(lead)), {
      leadId,
    });
  } catch (err) {
    console.error("[external/leads/:id] GET:", err);
    return finishApiKeyRequest(
      ctx,
      endpoint,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const endpoint = "/api/external/leads/:leadId";
  const auth = await requireApiKey(request, "update_lead", endpoint);
  if (auth.error) return auth.error;
  const ctx = auth.context!;
  const { leadId } = await params;

  try {
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
    if (!lead || lead.apiKeyId !== ctx.apiKey.id) {
      return finishApiKeyRequest(ctx, endpoint, ApiKeyErrors.notFound("Lead"));
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const updatedFields: string[] = [];

    for (const field of UPDATABLE_LEAD_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
        updatedFields.push(field);
      }
    }

    if (updatedFields.length === 0) {
      return finishApiKeyRequest(
        ctx,
        endpoint,
        ApiKeyErrors.validationFailed({ _: "No updatable fields provided" }),
        { requestBody: body, leadId }
      );
    }

    await db.update(partnerLeads).set(updates).where(eq(partnerLeads.id, leadId));

    return finishApiKeyRequest(
      ctx,
      endpoint,
      NextResponse.json({ success: true, leadId, updatedFields }),
      { requestBody: body, leadId }
    );
  } catch (err) {
    console.error("[external/leads/:id] PATCH:", err);
    return finishApiKeyRequest(
      ctx,
      endpoint,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

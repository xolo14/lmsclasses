import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const endpoint = "GET /api/external/leads/:leadId";
  const auth = await requireApiKey(request, "submit_lead", endpoint);
  if (auth.error) return auth.error;

  const { apiKey, ipAddress } = auth.context!;
  const { leadId } = await params;

  try {
    const [lead] = await db
      .select()
      .from(partnerLeads)
      .where(eq(partnerLeads.id, leadId))
      .limit(1);

    if (!lead || lead.apiKeyId !== apiKey.id) {
      const response = NextResponse.json({ error: "Lead not found" }, { status: 404 });
      return finishApiKeyRequest(apiKey, endpoint, ipAddress, response);
    }

    const response = NextResponse.json({
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      status: lead.status,
      paymentStatus: lead.paymentStatus,
      studentCreated: lead.studentCreated,
    });
    return finishApiKeyRequest(apiKey, endpoint, ipAddress, response);
  } catch (err) {
    console.error("[api/external/leads/[leadId]] GET:", err);
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return finishApiKeyRequest(apiKey, endpoint, ipAddress, response);
  }
}

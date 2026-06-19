import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { externalLeadSchema } from "@/lib/validations/partner-lead";
import { resolveCourseByName } from "@/lib/partner-student-service";
import { logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "POST /api/external/leads";

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "submit_lead", ENDPOINT);
  if (auth.error) return auth.error;

  const { apiKey, ipAddress } = auth.context!;

  try {
    const body = await request.json();
    const parsed = externalLeadSchema.safeParse(body);
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
      return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
    }

    const { name, email, phone, course, source, utm_source, utm_medium, utm_campaign } =
      parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const [duplicate] = await db
      .select({ id: partnerLeads.id })
      .from(partnerLeads)
      .where(and(eq(partnerLeads.email, normalizedEmail), eq(partnerLeads.course, course)))
      .limit(1);

    if (duplicate) {
      const response = NextResponse.json(
        { error: "Duplicate lead for this email and course" },
        { status: 409 }
      );
      return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
    }

    const resolved = await resolveCourseByName(course);

    const [lead] = await db
      .insert(partnerLeads)
      .values({
        name,
        email: normalizedEmail,
        phone,
        course,
        courseSlug: resolved?.slug ?? null,
        recordCourseId: resolved?.id ?? null,
        source: source ?? null,
        utmParams: {
          utm_source,
          utm_medium,
          utm_campaign,
        },
        apiKeyId: apiKey.id,
        paymentStatus: "pending",
        studentCreated: false,
        status: "new",
      })
      .returning();

    await logAction({
      action: "EXTERNAL_LEAD_SUBMITTED",
      entity: "PartnerLead",
      entityId: lead.id,
      metadata: { apiKeyId: apiKey.id, apiKeyName: apiKey.name, source },
      ipAddress,
    });

    const response = NextResponse.json(
      { success: true, leadId: lead.id, message: "Lead received" },
      { status: 201 }
    );
    return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
  } catch (err) {
    console.error("[api/external/leads] POST:", err);
    const response = NextResponse.json({ error: "Internal server error" }, { status: 500 });
    return finishApiKeyRequest(apiKey, ENDPOINT, ipAddress, response);
  }
}

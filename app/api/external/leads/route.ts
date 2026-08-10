import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireApiKey, finishApiKeyRequest, courseAllowed } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import { normalizeLeadBody, validateLeadFields } from "@/lib/partner-lead-validation";
import { resolvePartnerCourse } from "@/lib/partner-course-service";
import { buildLeadInsertValues, serializeLeadStatus } from "@/lib/partner-lead-serialize";
import { logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/leads";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "list_own_leads", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const course = searchParams.get("course");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(partnerLeads.apiKeyId, ctx.apiKey.id)];
    if (status) conditions.push(eq(partnerLeads.status, status as "new"));
    if (paymentStatus) {
      conditions.push(
        eq(partnerLeads.paymentStatus, paymentStatus as "pending")
      );
    }
    if (course) conditions.push(ilike(partnerLeads.course, `%${course}%`));
    if (dateFrom) conditions.push(gte(partnerLeads.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(partnerLeads.createdAt, new Date(dateTo)));

    const where = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partnerLeads)
      .where(where);

    const rows = await db
      .select()
      .from(partnerLeads)
      .where(where)
      .orderBy(desc(partnerLeads.createdAt))
      .limit(limit)
      .offset(offset);

    const total = countRow?.count ?? 0;
    const response = NextResponse.json({
      leads: rows.map(serializeLeadStatus),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
    return finishApiKeyRequest(ctx, ENDPOINT, response);
  } catch (err) {
    console.error("[external/leads] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiKey(request, "submit_lead", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const raw = await request.json();
    const body = normalizeLeadBody(raw as Record<string, unknown>);
    const keyCourseId =
      ctx.apiKey.courseId ??
      (ctx.apiKey.allowedCourses?.length === 1 ? ctx.apiKey.allowedCourses[0] : null);
    if (keyCourseId && !body.course && !body.courseId) {
      body.courseId = keyCourseId;
    }
    const validation = validateLeadFields(ctx.apiKey, body);
    if (!validation.ok) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed(validation.fields),
        { requestBody: body }
      );
    }

    const courseIdInput =
      body.courseId !== undefined && body.courseId !== null
        ? String(body.courseId).trim()
        : "";
    const courseNameInput = body.course ? String(body.course).trim() : "";

    const resolved = await resolvePartnerCourse({
      courseId: courseIdInput || undefined,
      courseName: courseNameInput || undefined,
    });
    if (!resolved) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.validationFailed({
          course: courseIdInput ? "Invalid courseId" : "Course not found on lmsclasses.com",
        }),
        { requestBody: body }
      );
    }

    if (!courseAllowed(ctx.apiKey, resolved.title, resolved.id)) {
      const allowed = (ctx.apiKey.allowedCourses ?? []) as string[];
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.courseNotAllowed(resolved.title, allowed),
        { requestBody: body }
      );
    }

    const normalizedEmail = String(body.email).trim().toLowerCase();
    const [duplicate] = await db
      .select({ id: partnerLeads.id })
      .from(partnerLeads)
      .where(
        and(eq(partnerLeads.email, normalizedEmail), eq(partnerLeads.recordCourseId, resolved.id))
      )
      .limit(1);

    if (duplicate) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        ApiKeyErrors.duplicateLead(duplicate.id),
        { requestBody: body }
      );
    }

    let lead: typeof partnerLeads.$inferSelect;
    try {
      const [inserted] = await db
        .insert(partnerLeads)
        .values(
          buildLeadInsertValues(body, {
            apiKeyId: ctx.apiKey.id,
            apiKeyName: ctx.apiKey.name,
            ipAddress: ctx.ipAddress,
            userAgent: request.headers.get("user-agent") ?? undefined,
            course: resolved.title,
            recordCourseId: resolved.id,
            courseSlug: resolved.slug,
            courseFee: resolved.price.toFixed(2),
          })
        )
        .returning();
      lead = inserted;
    } catch (insertErr) {
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
      const code = (insertErr as { code?: string }).code;
      if (code === "23505" || /unique|duplicate/i.test(msg)) {
        const [dup] = await db
          .select({ id: partnerLeads.id })
          .from(partnerLeads)
          .where(
            and(
              eq(partnerLeads.email, normalizedEmail),
              eq(partnerLeads.recordCourseId, resolved.id)
            )
          )
          .limit(1);
        return finishApiKeyRequest(
          ctx,
          ENDPOINT,
          ApiKeyErrors.duplicateLead(dup?.id ?? "unknown"),
          { requestBody: body }
        );
      }
      throw insertErr;
    }

    await logAction({
      action: "EXTERNAL_LEAD_SUBMITTED",
      entity: "PartnerLead",
      entityId: lead.id,
      metadata: { apiKeyId: ctx.apiKey.id, apiKeyName: ctx.apiKey.name, courseId: resolved.id },
      ipAddress: ctx.ipAddress,
    });

    const response = NextResponse.json(
      {
        success: true,
        leadId: lead.id,
        message: "Lead received successfully",
        course: resolved.title,
        courseId: resolved.id,
        courseFee: resolved.price,
        currency: "INR",
      },
      { status: 201 }
    );
    return finishApiKeyRequest(ctx, ENDPOINT, response, { requestBody: body, leadId: lead.id });
  } catch (err) {
    console.error("[external/leads] POST:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

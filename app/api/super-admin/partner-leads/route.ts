import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, partnerLeads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const course = searchParams.get("course");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);

    const conditions = [];
    if (status) conditions.push(eq(partnerLeads.status, status as "new" | "contacted" | "enrolled" | "lost"));
    if (paymentStatus) {
      conditions.push(
        eq(partnerLeads.paymentStatus, paymentStatus as "pending" | "completed" | "failed")
      );
    }
    if (course) conditions.push(ilike(partnerLeads.course, `%${course}%`));
    if (search) {
      conditions.push(
        or(
          ilike(partnerLeads.name, `%${search}%`),
          ilike(partnerLeads.email, `%${search}%`)
        )!
      );
    }
    if (from) conditions.push(gte(partnerLeads.createdAt, new Date(from)));
    if (to) conditions.push(lte(partnerLeads.createdAt, new Date(to)));

    const rows = await db
      .select({
        id: partnerLeads.id,
        name: partnerLeads.name,
        email: partnerLeads.email,
        phone: partnerLeads.phone,
        course: partnerLeads.course,
        courseSlug: partnerLeads.courseSlug,
        source: partnerLeads.source,
        utmParams: partnerLeads.utmParams,
        status: partnerLeads.status,
        paymentStatus: partnerLeads.paymentStatus,
        paymentId: partnerLeads.paymentId,
        paymentAmount: partnerLeads.paymentAmount,
        paymentCurrency: partnerLeads.paymentCurrency,
        paymentGateway: partnerLeads.paymentGateway,
        studentCreated: partnerLeads.studentCreated,
        studentId: partnerLeads.studentId,
        apiKeyId: partnerLeads.apiKeyId,
        apiKeyName: apiKeys.name,
        createdAt: partnerLeads.createdAt,
        updatedAt: partnerLeads.updatedAt,
      })
      .from(partnerLeads)
      .leftJoin(apiKeys, eq(partnerLeads.apiKeyId, apiKeys.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(partnerLeads.createdAt))
      .limit(limit);

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("[api/super-admin/partner-leads] GET:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

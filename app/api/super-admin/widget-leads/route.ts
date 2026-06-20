import { NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { widgetLeads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { processDelayedFollowUpEmails } from "@/lib/widget/lead-admin-service";
import { getWidgetLeadsDashboardStats } from "@/lib/widget/widget-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    // Best-effort delayed follow-up emails (2h after failed/cancelled)
    processDelayedFollowUpEmails().catch(console.error);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const apiKeyId = searchParams.get("apiKeyId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const conditions = [];
    if (apiKeyId) conditions.push(eq(widgetLeads.apiKeyId, apiKeyId));
    if (status) conditions.push(eq(widgetLeads.status, status as "new"));
    if (paymentStatus) {
      conditions.push(eq(widgetLeads.paymentStatus, paymentStatus as "initiated"));
    }
    if (search) {
      conditions.push(
        or(
          ilike(widgetLeads.fullName, `%${search}%`),
          ilike(widgetLeads.email, `%${search}%`),
          ilike(widgetLeads.phone, `%${search}%`)
        )!
      );
    }
    if (dateFrom) conditions.push(gte(widgetLeads.createdAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(widgetLeads.createdAt, new Date(dateTo)));

    const rows = await db
      .select()
      .from(widgetLeads)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(widgetLeads.createdAt))
      .limit(200);

    const stats = await getWidgetLeadsDashboardStats();

    return NextResponse.json({ data: rows, stats });
  } catch (err) {
    console.error("[super-admin/widget-leads] GET:", err);
    return NextResponse.json({ error: "Failed to fetch widget leads" }, { status: 500 });
  }
}

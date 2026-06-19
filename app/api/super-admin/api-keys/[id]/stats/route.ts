import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totals] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      todayLeads: sql<number>`count(*) filter (where ${partnerLeads.createdAt} >= ${todayStart})::int`,
      enrolledLeads: sql<number>`count(*) filter (where ${partnerLeads.status} = 'enrolled')::int`,
      revenue: sql<number>`coalesce(sum(${partnerLeads.amountPaidPaise}) filter (where ${partnerLeads.paymentStatus} = 'completed'), 0)::int`,
    })
    .from(partnerLeads)
    .where(eq(partnerLeads.apiKeyId, id));

  const total = totals?.totalLeads ?? 0;
  const enrolled = totals?.enrolledLeads ?? 0;

  return NextResponse.json({
    totalLeads: total,
    todayLeads: totals?.todayLeads ?? 0,
    enrolledLeads: enrolled,
    totalRevenue: (totals?.revenue ?? 0) / 100,
    conversionRate: total > 0 ? Math.round((enrolled / total) * 1000) / 10 : 0,
  });
}

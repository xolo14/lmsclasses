import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, recordCourses, widgetEvents, widgetLeads } from "@/lib/db/schema";

export type ApiKeyListStats = {
  totalLeads: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
};

export type ApiKeyFunnelStep = {
  step: string;
  label: string;
  count: number;
};

export type ApiKeyStats = {
  totalWidgetLoads: number;
  totalFormSubmits: number;
  totalPaymentAttempts: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  dropOffRate: number;
  funnel: ApiKeyFunnelStep[];
  recentLeads: (typeof widgetLeads.$inferSelect)[];
};

export async function getApiKeyListSummaries(
  keyIds: string[]
): Promise<Map<string, ApiKeyListStats>> {
  const map = new Map<string, ApiKeyListStats>();
  if (keyIds.length === 0) return map;

  const rows = await db
    .select({
      apiKeyId: widgetLeads.apiKeyId,
      totalLeads: sql<number>`count(*)::int`,
      totalConversions: sql<number>`count(*) filter (where ${widgetLeads.convertedToStudent} = true)::int`,
      totalRevenue: sql<number>`coalesce(sum(${widgetLeads.amountAttempted}) filter (where ${widgetLeads.paymentStatus} = 'completed'), 0)::int`,
    })
    .from(widgetLeads)
    .where(inArray(widgetLeads.apiKeyId, keyIds))
    .groupBy(widgetLeads.apiKeyId);

  for (const row of rows) {
    const total = row.totalLeads ?? 0;
    const conversions = row.totalConversions ?? 0;
    map.set(row.apiKeyId, {
      totalLeads: total,
      totalConversions: conversions,
      conversionRate: total > 0 ? Math.round((conversions / total) * 1000) / 10 : 0,
      totalRevenue: (row.totalRevenue ?? 0) / 100,
    });
  }
  return map;
}

export async function getApiKeyStats(keyId: string): Promise<ApiKeyStats | null> {
  // Select only id to avoid touching columns (e.g. form_slug) that may not be migrated yet.
  const [key] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1);
  if (!key) return null;

  const eventCounts = await db
    .select({
      eventType: widgetEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(widgetEvents)
    .where(eq(widgetEvents.apiKeyId, keyId))
    .groupBy(widgetEvents.eventType);

  const countByType = new Map(eventCounts.map((r) => [r.eventType, r.count ?? 0]));

  const [leadTotals] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      conversions: sql<number>`count(*) filter (where ${widgetLeads.convertedToStudent} = true)::int`,
      revenue: sql<number>`coalesce(sum(${widgetLeads.amountAttempted}) filter (where ${widgetLeads.paymentStatus} = 'completed'), 0)::int`,
      failed: sql<number>`count(*) filter (where ${widgetLeads.paymentStatus} in ('failed', 'cancelled'))::int`,
      initiated: sql<number>`count(*) filter (where ${widgetLeads.paymentStatus} = 'initiated')::int`,
    })
    .from(widgetLeads)
    .where(eq(widgetLeads.apiKeyId, keyId));

  const loads = countByType.get("widget_loaded") ?? 0;
  const submits = countByType.get("form_submitted") ?? leadTotals?.totalLeads ?? 0;
  const paymentAttempts =
    countByType.get("payment_initiated") ?? submits;
  const conversions =
    countByType.get("payment_success") ?? leadTotals?.conversions ?? 0;
  const failedEvents =
    (countByType.get("payment_failed") ?? 0) + (countByType.get("payment_cancelled") ?? 0);

  const paymentAttemptsTotal = paymentAttempts || leadTotals?.initiated || 0;
  const dropOffDenominator = paymentAttemptsTotal + failedEvents;
  const dropOffRate =
    dropOffDenominator > 0
      ? Math.round((failedEvents / dropOffDenominator) * 1000) / 10
      : 0;

  const recentLeads = await db
    .select()
    .from(widgetLeads)
    .where(eq(widgetLeads.apiKeyId, keyId))
    .orderBy(desc(widgetLeads.createdAt))
    .limit(10);

  const totalLeads = leadTotals?.totalLeads ?? 0;

  return {
    totalWidgetLoads: loads,
    totalFormSubmits: submits,
    totalPaymentAttempts: paymentAttemptsTotal,
    totalConversions: conversions,
    totalRevenue: (leadTotals?.revenue ?? 0) / 100,
    conversionRate:
      submits > 0 ? Math.round((conversions / submits) * 1000) / 10 : 0,
    dropOffRate,
    funnel: [
      { step: "loads", label: "Widget Loads", count: loads },
      { step: "submits", label: "Form Submits", count: submits },
      { step: "payments", label: "Payment Initiated", count: paymentAttemptsTotal },
      { step: "converted", label: "Converted", count: conversions },
    ],
    recentLeads,
  };
}

export async function getWidgetLeadsDashboardStats() {
  const [totals] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      conversions: sql<number>`count(*) filter (where ${widgetLeads.convertedToStudent} = true)::int`,
      failed: sql<number>`count(*) filter (where ${widgetLeads.paymentStatus} in ('failed', 'cancelled'))::int`,
      revenue: sql<number>`coalesce(sum(${widgetLeads.amountAttempted}) filter (where ${widgetLeads.paymentStatus} = 'completed'), 0)::int`,
    })
    .from(widgetLeads);

  const total = totals?.totalLeads ?? 0;
  const conversions = totals?.conversions ?? 0;

  return {
    totalLeads: total,
    conversionRate: total > 0 ? Math.round((conversions / total) * 1000) / 10 : 0,
    failedPayments: totals?.failed ?? 0,
    totalRevenue: (totals?.revenue ?? 0) / 100,
  };
}

export async function getApiKeyWithCourse(keyId: string) {
  const [row] = await db
    .select({
      key: apiKeys,
      courseTitle: recordCourses.title,
      coursePrice: recordCourses.price,
    })
    .from(apiKeys)
    .leftJoin(recordCourses, eq(apiKeys.courseId, recordCourses.id))
    .where(eq(apiKeys.id, keyId))
    .limit(1);
  return row ?? null;
}

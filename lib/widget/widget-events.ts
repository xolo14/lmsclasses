import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { widgetEvents } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";

export type WidgetEventType =
  | "widget_loaded"
  | "form_viewed"
  | "form_submitted"
  | "payment_initiated"
  | "payment_success"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_link_resent";

export async function logWidgetEvent({
  apiKey,
  eventType,
  leadId,
  domain,
  ipAddress,
  metadata,
}: {
  apiKey: ApiKey;
  eventType: WidgetEventType;
  leadId?: string;
  domain?: string | null;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  db.insert(widgetEvents)
    .values({
      apiKeyId: apiKey.id,
      eventType,
      leadId: leadId ?? null,
      domain: domain ?? null,
      ipAddress: ipAddress ?? null,
      metadata: metadata ?? null,
    })
    .catch((err) => console.error("[widget-event]", err));
}

export async function countWidgetSubmitsInWindow(
  apiKeyId: string,
  ipAddress: string | undefined,
  windowMinutes: number
): Promise<number> {
  if (!ipAddress) return 0;
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(widgetEvents)
    .where(
      and(
        eq(widgetEvents.apiKeyId, apiKeyId),
        eq(widgetEvents.eventType, "form_submitted"),
        eq(widgetEvents.ipAddress, ipAddress),
        gte(widgetEvents.createdAt, since)
      )
    );
  return row?.count ?? 0;
}

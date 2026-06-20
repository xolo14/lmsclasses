"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  manualConvertWidgetLead,
  processDelayedFollowUpEmails,
  resendPaymentLink,
  updateWidgetLeadStatus,
} from "@/lib/widget/lead-admin-service";
import type { WidgetLead } from "@/lib/db/schema";
import { getWidgetLeadsDashboardStats } from "@/lib/widget/widget-stats";

async function getSuperAdminActor() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "super_admin") return null;
  const h = await headers();
  return {
    userId: session.user.id,
    ipAddress:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      undefined,
  };
}

export async function resendPaymentLinkAction(leadId: string) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  const result = await resendPaymentLink(leadId, {
    actorUserId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  revalidatePath("/super-admin/leads");
  return result;
}

export async function manualConvertLeadAction(leadId: string) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  const result = await manualConvertWidgetLead(leadId, {
    actorUserId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  revalidatePath("/super-admin/leads");
  revalidatePath("/super-admin/api-keys");
  return result;
}

export async function updateWidgetLeadStatusAction(
  leadId: string,
  input: { status?: WidgetLead["status"]; adminNotes?: string | null }
) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  const result = await updateWidgetLeadStatus(leadId, input, {
    actorUserId: actor.userId,
    ipAddress: actor.ipAddress,
  });
  revalidatePath("/super-admin/leads");
  return result;
}

export async function processWidgetFollowUpEmailsAction() {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  const sent = await processDelayedFollowUpEmails();
  revalidatePath("/super-admin/leads");
  return { sent };
}

export async function getWidgetLeadsStatsAction() {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  return getWidgetLeadsDashboardStats();
}

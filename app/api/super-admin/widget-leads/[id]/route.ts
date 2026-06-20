import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { widgetLeads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import {
  manualConvertWidgetLead,
  resendPaymentLink,
  updateWidgetLeadStatus,
} from "@/lib/widget/lead-admin-service";
import { getClientIp, logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  const [lead] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, id)).limit(1);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json();
    const updated = await updateWidgetLeadStatus(
      id,
      {
        status: body.status,
        adminNotes: body.adminNotes,
      },
      { actorUserId: session!.user.id, ipAddress: getClientIp(request) }
    );
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json();
    const ip = getClientIp(request);
    const actorUserId = session!.user.id;

    if (body.action === "resend-payment") {
      const result = await resendPaymentLink(id, { actorUserId, ipAddress: ip });
      return NextResponse.json(result);
    }

    if (body.action === "manual-convert") {
      const result = await manualConvertWidgetLead(id, { actorUserId, ipAddress: ip });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}

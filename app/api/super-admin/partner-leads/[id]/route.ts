import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, partnerLeads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import {
  createStudentFromLead,
  resendPartnerStudentCredentials,
} from "@/lib/partner-student-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { id } = await params;

  try {
    const [row] = await db
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
        amountPaidPaise: partnerLeads.amountPaidPaise,
        paymentCurrency: partnerLeads.paymentCurrency,
        paymentGateway: partnerLeads.paymentGateway,
        studentCreated: partnerLeads.studentCreated,
        studentId: partnerLeads.studentId,
        apiKeyName: apiKeys.name,
        createdAt: partnerLeads.createdAt,
        updatedAt: partnerLeads.updatedAt,
      })
      .from(partnerLeads)
      .leftJoin(apiKeys, eq(partnerLeads.apiKeyId, apiKeys.id))
      .where(eq(partnerLeads.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error("[api/super-admin/partner-leads/[id]] GET:", err);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  try {
    const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, id)).limit(1);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (action === "resend-credentials") {
      if (!lead.studentCreated) {
        return NextResponse.json({ error: "Student not created yet" }, { status: 400 });
      }
      await resendPartnerStudentCredentials(id, {
        actorUserId: session!.user.id,
        ipAddress: getClientIp(request),
      });
      return NextResponse.json({ success: true, message: "Credentials resent" });
    }

    if (action === "confirm-payment") {
      if (lead.paymentStatus === "completed") {
        return NextResponse.json({ error: "Payment already confirmed" }, { status: 409 });
      }

      await db
        .update(partnerLeads)
        .set({
          paymentStatus: "completed",
          paymentId: body.paymentId ?? `MANUAL_${Date.now()}`,
          paymentGateway: body.paymentGateway ?? "manual",
          amountPaidPaise: body.amount ? Math.round(Number(body.amount) * 100) : null,
          paymentConfirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(partnerLeads.id, id));

      const [updated] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, id)).limit(1);

      if (!updated!.studentCreated) {
        await createStudentFromLead(updated!, {
          actorUserId: session!.user.id,
          ipAddress: getClientIp(request),
        });
      }

      await logAction({
        userId: session!.user.id,
        role: "super_admin",
        action: "PARTNER_PAYMENT_MANUAL_CONFIRM",
        entity: "PartnerLead",
        entityId: id,
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        success: true,
        message: "Payment confirmed, student credentials sent",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed";
    console.error("[api/super-admin/partner-leads/[id]] POST:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

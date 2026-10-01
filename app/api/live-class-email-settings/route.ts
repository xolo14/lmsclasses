import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { getClientIp, logAction } from "@/lib/audit";
import {
  getOrgLiveClassEmailPrefs,
  getSystemLiveClassEmailPrefs,
  setOrgLiveClassEmailPrefs,
  setSystemLiveClassEmailPrefs,
} from "@/lib/live-class-email-prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  emailMentor: z.boolean().optional(),
  emailStudents: z.boolean().optional(),
});

/**
 * GET/PATCH /api/live-class-email-settings
 * org_admin → their organisation's booleans; super_admin → system defaults (direct enrollments).
 * Scope is always derived from the session, never from the body.
 */
export async function GET() {
  const { error, session } = await requireAuth(["org_admin", "super_admin"]);
  if (error) return error;
  const user = session!.user;

  if (user.role === "super_admin") {
    const prefs = await getSystemLiveClassEmailPrefs();
    return NextResponse.json({ scope: "system", ...prefs });
  }
  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  const prefs = await getOrgLiveClassEmailPrefs(organisationId);
  return NextResponse.json({ scope: "organisation", ...prefs });
}

export async function PATCH(request: Request) {
  const { error, session } = await requireAuth(["org_admin", "super_admin"]);
  if (error) return error;
  const user = session!.user;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  if (user.role === "super_admin") {
    await setSystemLiveClassEmailPrefs(parsed.data);
    void logAction({
      userId: user.id,
      role: user.role,
      action: "live_class.email_settings_updated",
      entity: "SystemSetting",
      metadata: parsed.data,
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ success: true });
  }

  const organisationId = await resolveOrganisationId(session!);
  if (!organisationId) return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  await setOrgLiveClassEmailPrefs(organisationId, parsed.data);
  void logAction({
    userId: user.id,
    role: user.role,
    action: "live_class.email_settings_updated",
    entity: "Organisation",
    entityId: organisationId,
    metadata: parsed.data,
    ipAddress: getClientIp(request),
  });
  return NextResponse.json({ success: true });
}

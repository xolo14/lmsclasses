import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClientIp, logAction } from "@/lib/audit";
import { getDefaultMeetMode, setDefaultMeetMode, type DefaultMeetMode } from "@/lib/google-platform";
import { readApiJson } from "@/lib/api-url-transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: DefaultMeetMode[] = ["google_platform", "google_host"];

/** GET /api/google/platform-settings — Super Admin default Meet host mode. */
export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  return NextResponse.json({ defaultMeetMode: await getDefaultMeetMode() }, { headers: { "Cache-Control": "no-store" } });
}

/** PATCH /api/google/platform-settings { defaultMeetMode } */
export async function PATCH(request: Request) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const body = ((await readApiJson(request)) ?? {}) as { defaultMeetMode?: unknown };
  const mode = typeof body.defaultMeetMode === "string" ? body.defaultMeetMode : "";
  if (!MODES.includes(mode as DefaultMeetMode)) {
    return NextResponse.json({ error: "defaultMeetMode must be google_platform or google_host" }, { status: 400 });
  }
  await setDefaultMeetMode(mode as DefaultMeetMode);
  void logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "google.default_meet_mode",
    entity: "system_settings",
    entityId: "live_class_default_meet_mode",
    metadata: { defaultMeetMode: mode },
    ipAddress: getClientIp(request),
  });
  return NextResponse.json({ ok: true, defaultMeetMode: mode });
}

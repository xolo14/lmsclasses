import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";

const DEFAULTS = {
  hero_card_title: "Full Stack Bootcamp",
  hero_card_subtitle: "12 weeks · Live + Recorded",
  hero_card_student_count: "500+",
  hero_card_student_label: "Active Students",
  hero_card_live_badge: "Live class starting soon",
  hero_card_btn_text: "Join Live Class",
};

export async function GET() {
  try {
    const rows = await db.select().from(systemSettings);
    const settings = { ...DEFAULTS };
    for (const row of rows) {
      if (row.key in DEFAULTS) {
        settings[row.key as keyof typeof DEFAULTS] = row.value;
      }
    }
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("[system-settings] GET failed:", error);
    return NextResponse.json({ error: "Failed to load system settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, session } = await requireAuth(["super_admin"]);
    if (error) return error;

    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updates = [];
    for (const [key, value] of Object.entries(body)) {
      if (key in DEFAULTS) {
        const valStr = String(value ?? "").trim();
        updates.push(
          db
            .insert(systemSettings)
            .values({ key, value: valStr, updatedAt: new Date() })
            .onConflictDoUpdate({
              target: systemSettings.key,
              set: { value: valStr, updatedAt: new Date() },
            })
        );
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);

      await logAction({
        userId: session!.user.id,
        role: session!.user.role,
        action: "UPDATED_SYSTEM_SETTINGS",
        entity: "SystemSetting",
        metadata: { keys: Object.keys(body) },
        ipAddress: getClientIp(request),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[system-settings] PATCH failed:", error);
    return NextResponse.json({ error: error.message ?? "Failed to update settings" }, { status: 500 });
  }
}

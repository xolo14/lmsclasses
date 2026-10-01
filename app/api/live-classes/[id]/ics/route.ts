import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveCourses, users } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { appName } from "@/lib/mail";
import { authorizeClassAccess, classEndMs } from "@/lib/live-class-join";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines must be ≤ 75 octets; fold with CRLF + space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 73) {
    let cut = 73;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 73) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * GET /api/live-classes/[id]/ics — calendar file whose URL is the LMS join link (not the raw Meet).
 * Same authorization as join, without the time window.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const decision = await authorizeClassAccess(session, id, { enforceTimeWindow: false });
  if (!decision.ok) {
    return NextResponse.json({ error: decision.message }, { status: decision.status === 425 ? 403 : decision.status });
  }
  const { cls } = decision;

  const [[course], [mentor]] = await Promise.all([
    db.select({ title: liveCourses.title }).from(liveCourses).where(eq(liveCourses.id, cls.courseId)).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, cls.mentorId)).limit(1),
  ]);

  const joinUrl = `${getAppUrl()}/api/live-classes/${cls.id}/join`;
  const host = new URL(getAppUrl()).hostname;
  const description = [
    course ? `Course: ${course.title}` : null,
    mentor ? `Mentor: ${mentor.name}` : null,
    "",
    `Join: ${joinUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsText(appName)}//Live Class//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${cls.id}@${host}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(cls.scheduledAt)}`,
    `DTEND:${icsDate(new Date(classEndMs(cls)))}`,
    `SUMMARY:${icsText(cls.title)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${joinUrl}`,
    `LOCATION:${icsText(joinUrl)}`,
    cls.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(cls.title)} starts in 10 minutes`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const body = lines.map(fold).join("\r\n") + "\r\n";
  const filename = `${cls.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "live-class"}.ics`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

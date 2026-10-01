import { and, eq, isNull } from "drizzle-orm";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { batches, liveClasses, studentCourses, type LiveClass } from "@/lib/db/schema";
import { hasLiveAccess } from "@/lib/content-access";
import { resolveOrganisationId } from "@/lib/api-auth";

/** Students may join from 10 min before start until 30 min after the scheduled end. */
export const JOIN_OPENS_BEFORE_MS = 10 * 60_000;
export const JOIN_CLOSES_AFTER_MS = 30 * 60_000;

export type JoinDecision =
  | { ok: true; cls: LiveClass; enrollmentId: string | null; isStudent: boolean }
  | { ok: false; status: 403 | 404 | 410; code: "not_found" | "forbidden" | "not_enrolled" | "no_access" | "cancelled" | "ended"; message: string }
  | { ok: false; status: 425; code: "too_early"; message: string; cls: LiveClass };

export function classEndMs(cls: Pick<LiveClass, "scheduledAt" | "duration">): number {
  return cls.scheduledAt.getTime() + (cls.duration ?? 60) * 60_000;
}

/**
 * Server-side authorization for joining / exporting a class.
 * - students: active enrollment with live access, same batch (or course-wide class), inside the time window
 * - mentor: own class or host
 * - super_admin / manager: any class
 * - org_admin: classes of batches in their organisation
 */
export async function authorizeClassAccess(
  session: Session,
  classId: string,
  opts: { enforceTimeWindow: boolean }
): Promise<JoinDecision> {
  const user = session.user;
  const [cls] = await db
    .select()
    .from(liveClasses)
    .where(and(eq(liveClasses.id, classId), isNull(liveClasses.deletedAt)))
    .limit(1);
  if (!cls) return { ok: false, status: 404, code: "not_found", message: "Live class not found." };
  if (cls.status === "cancelled") return { ok: false, status: 410, code: "cancelled", message: "This class was cancelled." };

  if (user.role === "super_admin" || user.role === "manager") {
    return { ok: true, cls, enrollmentId: null, isStudent: false };
  }
  if (user.role === "mentor") {
    if (cls.mentorId !== user.id && cls.hostUserId !== user.id) {
      return { ok: false, status: 403, code: "forbidden", message: "This class is not assigned to you." };
    }
    return { ok: true, cls, enrollmentId: null, isStudent: false };
  }
  if (user.role === "org_admin") {
    if (cls.hostUserId === user.id) return { ok: true, cls, enrollmentId: null, isStudent: false };
    const orgId = await resolveOrganisationId(session);
    if (!orgId || !cls.batchId) return { ok: false, status: 403, code: "forbidden", message: "Not available for your organisation." };
    const [batch] = await db.select({ organisationId: batches.organisationId }).from(batches).where(eq(batches.id, cls.batchId)).limit(1);
    if (!batch || batch.organisationId !== orgId) {
      return { ok: false, status: 403, code: "forbidden", message: "Not available for your organisation." };
    }
    return { ok: true, cls, enrollmentId: null, isStudent: false };
  }
  if (user.role !== "student") {
    return { ok: false, status: 403, code: "forbidden", message: "Not available for your account." };
  }

  const [enrollment] = await db
    .select()
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, user.id),
        eq(studentCourses.liveCourseId, cls.courseId),
        eq(studentCourses.isActive, true)
      )
    )
    .limit(1);
  if (!enrollment) return { ok: false, status: 403, code: "not_enrolled", message: "You are not enrolled in this course." };
  if (!hasLiveAccess(enrollment)) {
    return { ok: false, status: 403, code: "no_access", message: "Your live class access is not active." };
  }
  if (cls.batchId && enrollment.batchId !== cls.batchId) {
    return { ok: false, status: 403, code: "forbidden", message: "This class belongs to a different batch." };
  }

  if (opts.enforceTimeWindow) {
    const now = Date.now();
    if (now < cls.scheduledAt.getTime() - JOIN_OPENS_BEFORE_MS) {
      return { ok: false, status: 425, code: "too_early", message: "The class has not opened yet.", cls };
    }
    if (now > classEndMs(cls) + JOIN_CLOSES_AFTER_MS || cls.status === "completed") {
      return { ok: false, status: 410, code: "ended", message: "This class has ended." };
    }
  }

  return { ok: true, cls, enrollmentId: enrollment.id, isStudent: true };
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Minimal self-refreshing page for "link not ready" / "too early" states. */
export function joinHtmlPage(opts: { title: string; message: string; refreshSec?: number; backHref?: string }): Response {
  const refresh = opts.refreshSec ? `<meta http-equiv="refresh" content="${opts.refreshSec}">` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${refresh}
<title>${esc(opts.title)}</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f6f4ef;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;max-width:420px;width:calc(100% - 32px);box-shadow:0 10px 30px -15px rgba(0,0,0,.2)}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 16px;color:#475569;line-height:1.5}a{color:#0f766e;font-weight:600}</style></head>
<body><div class="card"><h1>${esc(opts.title)}</h1><p>${esc(opts.message)}</p>
${opts.refreshSec ? `<p style="font-size:13px;color:#94a3b8">This page refreshes automatically every ${opts.refreshSec} seconds.</p>` : ""}
${opts.backHref ? `<p><a href="${esc(opts.backHref)}">Back to my classes</a></p>` : ""}</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

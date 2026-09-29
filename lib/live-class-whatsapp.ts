import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, studentCourses, liveCourses, batches } from "@/lib/db/schema";
import {
  isMetaWhatsAppConfigured,
  sendLiveClassMeetingLinkWhatsApp,
} from "@/lib/meta-whatsapp";

export type LiveClassWhatsAppNotifyResult = {
  configured: boolean;
  sent: number;
  failed: number;
  skippedNoPhone: number;
  errors: string[];
};

export async function notifyStudentsLiveClassMeetingLink(opts: {
  liveClassId: string;
  courseId: string;
  batchId: string | null;
  title: string;
  scheduledAt: Date;
  meetingLink: string;
}): Promise<LiveClassWhatsAppNotifyResult> {
  const result: LiveClassWhatsAppNotifyResult = {
    configured: isMetaWhatsAppConfigured(),
    sent: 0,
    failed: 0,
    skippedNoPhone: 0,
    errors: [],
  };

  if (!result.configured) {
    result.errors.push(
      "Meta WhatsApp is not configured (META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)"
    );
    return result;
  }

  if (!opts.meetingLink?.trim()) {
    result.errors.push("Meeting link is required to send WhatsApp notifications");
    return result;
  }

  const [[course], [batch]] = await Promise.all([
    db
      .select({ title: liveCourses.title })
      .from(liveCourses)
      .where(eq(liveCourses.id, opts.courseId))
      .limit(1),
    opts.batchId
      ? db
          .select({ name: batches.name })
          .from(batches)
          .where(eq(batches.id, opts.batchId))
          .limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
  ]);

  const courseName = course?.title ?? "Live Course";
  const batchName = batch?.name ?? null;

  const enrollmentConditions = [
    eq(studentCourses.liveCourseId, opts.courseId),
    eq(studentCourses.isActive, true),
    isNull(users.deletedAt),
    eq(users.role, "student"),
    isNotNull(users.phone),
  ];

  if (opts.batchId) {
    enrollmentConditions.push(eq(studentCourses.batchId, opts.batchId));
  }

  const students = await db
    .select({
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .innerJoin(studentCourses, eq(studentCourses.studentId, users.id))
    .where(and(...enrollmentConditions));

  const seenPhones = new Set<string>();
  const startedAt = Date.now();
  /** Hard cap so a large batch cannot hang the Node worker forever. */
  const MAX_NOTIFY_MS = 45_000;
  const SEND_TIMEOUT_MS = 8_000;

  for (const student of students) {
    if (Date.now() - startedAt > MAX_NOTIFY_MS) {
      result.errors.push(
        `Stopped early after ${Math.round(MAX_NOTIFY_MS / 1000)}s to avoid blocking the server.`
      );
      break;
    }

    const phone = student.phone?.trim();
    if (!phone) {
      result.skippedNoPhone += 1;
      continue;
    }

    const phoneKey = phone.replace(/\D/g, "");
    if (seenPhones.has(phoneKey)) continue;
    seenPhones.add(phoneKey);

    let sendResult: Awaited<ReturnType<typeof sendLiveClassMeetingLinkWhatsApp>>;
    try {
      sendResult = await Promise.race([
        sendLiveClassMeetingLinkWhatsApp({
          studentName: student.name,
          phone,
          classTitle: opts.title,
          courseName,
          batchName,
          scheduledAt: opts.scheduledAt,
          meetingLink: opts.meetingLink.trim(),
          liveClassId: opts.liveClassId,
        }),
        new Promise<Awaited<ReturnType<typeof sendLiveClassMeetingLinkWhatsApp>>>((resolve) => {
          setTimeout(
            () => resolve({ ok: false, error: `Timed out after ${SEND_TIMEOUT_MS}ms` }),
            SEND_TIMEOUT_MS
          );
        }),
      ]);
    } catch (err) {
      sendResult = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    if (sendResult.ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      result.errors.push(`${student.name} (${phone}): ${sendResult.error}`);
      console.error("[meta-whatsapp] live class WhatsApp failed:", sendResult.error, {
        student: student.name,
        phone,
        liveClassId: opts.liveClassId,
      });
    }

    // Stay under Meta Cloud API rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  return result;
}

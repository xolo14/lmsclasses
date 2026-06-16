import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, studentCourses, liveCourses, batches } from "@/lib/db/schema";
import {
  isInteraktConfigured,
  sendLiveClassMeetingLinkWhatsApp,
} from "@/lib/interakt";

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
    configured: isInteraktConfigured(),
    sent: 0,
    failed: 0,
    skippedNoPhone: 0,
    errors: [],
  };

  if (!result.configured) {
    result.errors.push("Interakt is not configured (INTERAKT_API_KEY / INTERAKT_TEMPLATE_NAME)");
    return result;
  }

  if (!opts.meetingLink?.trim()) {
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

  for (const student of students) {
    const phone = student.phone?.trim();
    if (!phone) {
      result.skippedNoPhone += 1;
      continue;
    }

    const phoneKey = phone.replace(/\D/g, "");
    if (seenPhones.has(phoneKey)) continue;
    seenPhones.add(phoneKey);

    const sendResult = await sendLiveClassMeetingLinkWhatsApp({
      studentName: student.name,
      phone,
      classTitle: opts.title,
      courseName,
      batchName,
      scheduledAt: opts.scheduledAt,
      meetingLink: opts.meetingLink.trim(),
      liveClassId: opts.liveClassId,
    });

    if (sendResult.ok) {
      result.sent += 1;
    } else {
      result.failed += 1;
      result.errors.push(`${student.name} (${phone}): ${sendResult.error}`);
      console.error("[interakt] live class WhatsApp failed:", sendResult.error, {
        student: student.name,
        phone,
        liveClassId: opts.liveClassId,
      });
    }

    // Stay under Interakt rate limit (~40/min on basic plans)
    await new Promise((r) => setTimeout(r, 200));
  }

  return result;
}

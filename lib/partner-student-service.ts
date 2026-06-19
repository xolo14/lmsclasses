import bcrypt from "bcryptjs";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { partnerLeads, recordCourses, studentCourses, users } from "@/lib/db/schema";
import type { PartnerLead } from "@/lib/db/schema";
import { generatePartnerLmsId, generateStudentPassword } from "@/lib/generate-credentials";
import { sendPartnerStudentCredentialsEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

type ResolvedCourse = {
  id: string;
  title: string;
  slug: string;
};

export async function resolveCourseByName(courseName: string): Promise<ResolvedCourse | null> {
  const trimmed = courseName.trim();
  const [byTitle] = await db
    .select({ id: recordCourses.id, title: recordCourses.title, slug: recordCourses.slug })
    .from(recordCourses)
    .where(
      and(
        eq(recordCourses.isActive, true),
        isNull(recordCourses.deletedAt),
        ilike(recordCourses.title, trimmed)
      )
    )
    .limit(1);
  if (byTitle?.slug) return { id: byTitle.id, title: byTitle.title, slug: byTitle.slug };

  const slugCandidate = trimmed.toLowerCase().replace(/\s+/g, "-");
  const [bySlug] = await db
    .select({ id: recordCourses.id, title: recordCourses.title, slug: recordCourses.slug })
    .from(recordCourses)
    .where(
      and(
        eq(recordCourses.isActive, true),
        isNull(recordCourses.deletedAt),
        or(eq(recordCourses.slug, slugCandidate), ilike(recordCourses.slug, slugCandidate))
      )
    )
    .limit(1);
  if (bySlug?.slug) return { id: bySlug.id, title: bySlug.title, slug: bySlug.slug };

  return null;
}

async function createUniqueLmsId(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const lmsId = generatePartnerLmsId();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.lmsId, lmsId))
      .limit(1);
    if (!existing) return lmsId;
  }
  throw new Error("Failed to generate unique LMS ID");
}

export type CreateStudentFromLeadResult = {
  studentId: string;
  created: boolean;
  emailSent: boolean;
};

export async function createStudentFromLead(
  lead: PartnerLead,
  options?: { ipAddress?: string; actorUserId?: string; resendOnly?: boolean }
): Promise<CreateStudentFromLeadResult> {
  if (!lead.recordCourseId) {
    const resolved = await resolveCourseByName(lead.course);
    if (!resolved) {
      throw new Error(`Course not found: ${lead.course}`);
    }
    await db
      .update(partnerLeads)
      .set({
        recordCourseId: resolved.id,
        courseSlug: resolved.slug,
        updatedAt: new Date(),
      })
      .where(eq(partnerLeads.id, lead.id));
    lead = { ...lead, recordCourseId: resolved.id, courseSlug: resolved.slug };
  }

  const recordCourseId = lead.recordCourseId;
  if (!recordCourseId) {
    throw new Error(`Course not found: ${lead.course}`);
  }

  const email = lead.email.trim().toLowerCase();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  let studentId: string;
  let plainPassword: string;
  let lmsId: string;
  let created = false;

  if (existingUser) {
    studentId = existingUser.id;
    lmsId = existingUser.lmsId ?? (await createUniqueLmsId());

    const [enrollment] = await db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.recordCourseId, recordCourseId),
          eq(studentCourses.isActive, true)
        )
      )
      .limit(1);

    if (!enrollment) {
      await db.insert(studentCourses).values({
        studentId,
        recordCourseId,
        liveCourseId: null,
        batchId: null,
        organisationId: null,
        enrollmentSource: "partner_api",
      });
    }

    if (options?.resendOnly) {
      throw new Error("Cannot resend credentials — student already exists. Use password reset flow.");
    }
    plainPassword = generateStudentPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, studentId));
  } else {
    plainPassword = generateStudentPassword();
    lmsId = await createUniqueLmsId();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const [student] = await db
      .insert(users)
      .values({
        name: lead.name,
        email,
        phone: lead.phone,
        password: hashedPassword,
        role: "student",
        lmsId,
        organisationId: null,
      })
      .returning();

    await db.insert(studentCourses).values({
      studentId: student.id,
      recordCourseId,
      liveCourseId: null,
      batchId: null,
      organisationId: null,
      enrollmentSource: "partner_api",
    });

    studentId = student.id;
    created = true;
  }

  const [course] = await db
    .select({ title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, recordCourseId))
    .limit(1);

  let emailSent = false;
  try {
    await sendPartnerStudentCredentialsEmail({
      to: email,
      name: lead.name,
      courseTitle: course?.title ?? lead.course,
      lmsId,
      password: plainPassword,
    });
    emailSent = true;
  } catch (err) {
    console.error("[partner-student] email failed:", err);
  }

  await db
    .update(partnerLeads)
    .set({
      studentCreated: true,
      studentId,
      status: "enrolled",
      updatedAt: new Date(),
    })
    .where(eq(partnerLeads.id, lead.id));

  await logAction({
    userId: options?.actorUserId,
    role: options?.actorUserId ? "super_admin" : undefined,
    action: created ? "PARTNER_STUDENT_CREATED" : "PARTNER_STUDENT_ENROLLED",
    entity: "PartnerLead",
    entityId: lead.id,
    metadata: {
      studentId,
      course: lead.course,
      emailSent,
      apiKeyId: lead.apiKeyId,
    },
    ipAddress: options?.ipAddress,
  });

  return { studentId, created, emailSent };
}

export async function resendPartnerStudentCredentials(
  leadId: string,
  options?: { ipAddress?: string; actorUserId?: string }
): Promise<{ emailSent: boolean }> {
  const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (!lead.studentCreated || !lead.studentId) {
    throw new Error("Student has not been created for this lead");
  }

  const [student] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, lead.studentId), isNull(users.deletedAt)))
    .limit(1);
  if (!student) throw new Error("Student not found");

  const plainPassword = generateStudentPassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 12);
  await db
    .update(users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, student.id));

  const [course] = lead.recordCourseId
    ? await db
        .select({ title: recordCourses.title })
        .from(recordCourses)
        .where(eq(recordCourses.id, lead.recordCourseId))
        .limit(1)
    : [null];

  await sendPartnerStudentCredentialsEmail({
    to: student.email,
    name: student.name,
    courseTitle: course?.title ?? lead.course,
    lmsId: student.lmsId ?? "—",
    password: plainPassword,
  });

  await logAction({
    userId: options?.actorUserId,
    role: "super_admin",
    action: "PARTNER_CREDENTIALS_RESENT",
    entity: "PartnerLead",
    entityId: lead.id,
    metadata: { studentId: student.id },
    ipAddress: options?.ipAddress,
  });

  return { emailSent: true };
}

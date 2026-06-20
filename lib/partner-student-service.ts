import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, partnerLeads, recordCourses, studentCourses, users } from "@/lib/db/schema";
import type { ApiKey, PartnerLead } from "@/lib/db/schema";
import { generatePartnerLmsId, generateStudentPassword, generateUsername } from "@/lib/generate-credentials";
import { sendPartnerStudentCredentialsEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";
import { resolveCourseByName } from "@/lib/partner-course-service";
import { notifyPartnerWebhook } from "@/lib/partner-webhook";
import { isTestKey } from "@/lib/api-key-service";

export { resolveCourseByName } from "@/lib/partner-course-service";

async function createUniqueLmsId(tx: any = db): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const lmsId = generatePartnerLmsId();
    const [existing] = await tx
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
  username: string;
  loginUrl: string;
  lmsId: string;
};

export async function createStudentFromLead(
  lead: PartnerLead,
  options?: {
    ipAddress?: string;
    actorUserId?: string;
    apiKey?: ApiKey;
    skipEmail?: boolean;
  }
): Promise<CreateStudentFromLeadResult> {
  const apiKey =
    options?.apiKey ??
    (lead.apiKeyId
      ? (await db.select().from(apiKeys).where(eq(apiKeys.id, lead.apiKeyId)).limit(1))[0]
      : undefined);

  if (apiKey && isTestKey(apiKey)) {
    const username = generateUsername(lead.name);
    await db
      .update(partnerLeads)
      .set({
        studentCreated: true,
        studentUsername: username,
        status: "enrolled",
        updatedAt: new Date(),
      })
      .where(eq(partnerLeads.id, lead.id));
    return {
      studentId: "test-mode",
      created: true,
      emailSent: false,
      username,
      loginUrl: `${getAppUrl()}/login`,
      lmsId: "TEST",
    };
  }

  if (!lead.recordCourseId) {
    const resolved = await resolveCourseByName(lead.course);
    if (!resolved) throw new Error(`Course not found: ${lead.course}`);
    await db
      .update(partnerLeads)
      .set({
        recordCourseId: resolved.id,
        courseSlug: resolved.slug,
        courseFee: resolved.price.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(partnerLeads.id, lead.id));
    lead = { ...lead, recordCourseId: resolved.id, courseSlug: resolved.slug };
  }

  const recordCourseId = lead.recordCourseId!;
  const email = lead.email.trim().toLowerCase();
  const username = generateUsername(lead.name);

  let studentId = "";
  let plainPassword = "";
  let lmsId = "";
  let created = false;
  let shouldSendEmail = apiKey?.sendWelcomeEmail !== false && !options?.skipEmail;

  await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      studentId = existingUser.id;
      lmsId = existingUser.lmsId ?? (await createUniqueLmsId(tx));

      const [enrollment] = await tx
        .select({ id: studentCourses.id, isActive: studentCourses.isActive })
        .from(studentCourses)
        .where(
          and(
            eq(studentCourses.studentId, studentId),
            eq(studentCourses.recordCourseId, recordCourseId)
          )
        )
        .limit(1);

      if (existingUser.deletedAt !== null || !existingUser.isActive) {
        await tx
          .update(users)
          .set({
            deletedAt: null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, studentId));
      }

      if (!enrollment) {
        await tx.insert(studentCourses).values({
          studentId,
          recordCourseId,
          liveCourseId: null,
          batchId: null,
          organisationId: null,
          enrollmentSource: "partner_api",
        });
        plainPassword = generateStudentPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 12);
        await tx
          .update(users)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(eq(users.id, studentId));
        shouldSendEmail = shouldSendEmail && apiKey?.sendWelcomeEmail !== false;
      } else {
        if (!enrollment.isActive) {
          await tx
            .update(studentCourses)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(studentCourses.id, enrollment.id));
        }
        shouldSendEmail = false;
        plainPassword = generateStudentPassword();
      }
    } else {
      plainPassword = generateStudentPassword();
      lmsId = await createUniqueLmsId(tx);
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const [student] = await tx
        .insert(users)
        .values({
          name: lead.name,
          email,
          phone: lead.phone,
          password: hashedPassword,
          role: "student",
          lmsId,
          organisationId: null,
          collegeName: lead.city ?? null,
        })
        .returning();

      await tx.insert(studentCourses).values({
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

    const now = new Date();
    await tx
      .update(partnerLeads)
      .set({
        studentCreated: true,
        studentId,
        studentUsername: username,
        credentialsSentAt: shouldSendEmail ? now : null, // Set tentatively; will adjust below if sent
        status: "enrolled",
        updatedAt: now,
      })
      .where(eq(partnerLeads.id, lead.id));
  });

  const [course] = await db
    .select({ title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, recordCourseId))
    .limit(1);

  let emailSent = false;
  if (shouldSendEmail && plainPassword!) {
    try {
      await sendPartnerStudentCredentialsEmail({
        to: email,
        name: lead.name,
        courseTitle: course?.title ?? lead.course,
        lmsId,
        password: plainPassword!,
        username,
      });
      emailSent = true;
    } catch (err) {
      console.error("[partner-student] email failed:", err);
    }
  }

  if (emailSent) {
    await db
      .update(partnerLeads)
      .set({ credentialsSentAt: new Date(), updatedAt: new Date() })
      .where(eq(partnerLeads.id, lead.id));
  }

  if (apiKey) {
    notifyPartnerWebhook(apiKey, "student.created", lead).catch(console.error);
  }

  await logAction({
    userId: options?.actorUserId,
    role: options?.actorUserId ? "super_admin" : undefined,
    action: created ? "PARTNER_STUDENT_CREATED" : "PARTNER_STUDENT_ENROLLED",
    entity: "PartnerLead",
    entityId: lead.id,
    metadata: { studentId, course: lead.course, emailSent, username },
    ipAddress: options?.ipAddress,
  });

  return {
    studentId,
    created,
    emailSent,
    username,
    loginUrl: `${getAppUrl()}/login`,
    lmsId,
  };
}

export async function resendPartnerStudentCredentials(
  leadId: string,
  options?: { ipAddress?: string; actorUserId?: string; apiKey?: ApiKey }
): Promise<{ emailSent: boolean }> {
  const [lead] = await db.select().from(partnerLeads).where(eq(partnerLeads.id, leadId)).limit(1);
  if (!lead) throw new Error("Lead not found");
  if (!lead.studentCreated || !lead.studentId) {
    throw new Error("Student has not been created for this lead");
  }
  if (lead.paymentStatus !== "completed") {
    throw new Error("Payment not completed for this lead");
  }

  const apiKey = options?.apiKey;
  if (apiKey && isTestKey(apiKey)) {
    return { emailSent: false };
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
    username: lead.studentUsername ?? generateUsername(student.name),
  });

  await db
    .update(partnerLeads)
    .set({ credentialsSentAt: new Date(), updatedAt: new Date() })
    .where(eq(partnerLeads.id, lead.id));

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

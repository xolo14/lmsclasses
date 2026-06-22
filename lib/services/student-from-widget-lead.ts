import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses, studentCourses, users, widgetLeads } from "@/lib/db/schema";
import type { ApiKey, WidgetLead } from "@/lib/db/schema";
import { generatePartnerLmsId, generateStudentPassword, generateUsername } from "@/lib/generate-credentials";
import { sendPartnerStudentCredentialsEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";
import { resolveRedirectUrl } from "@/lib/app-url";
import { isTestKey } from "@/lib/api-key-service";

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

export type CreateStudentFromWidgetLeadResult = {
  studentId: string;
  created: boolean;
  emailSent: boolean;
  username: string;
  loginUrl: string;
  lmsId: string;
};

export async function createStudentFromWidgetLead(
  lead: WidgetLead,
  options?: { ipAddress?: string; apiKey?: ApiKey }
): Promise<CreateStudentFromWidgetLeadResult> {
  const apiKey = options?.apiKey;
  const loginUrl = resolveRedirectUrl(apiKey?.redirectOnSuccess);

  if (apiKey && isTestKey(apiKey)) {
    const username = generateUsername(lead.fullName);
    await db
      .update(widgetLeads)
      .set({
        convertedToStudent: true,
        status: "converted",
        updatedAt: new Date(),
      })
      .where(eq(widgetLeads.id, lead.id));
    return {
      studentId: "test-mode",
      created: true,
      emailSent: false,
      username,
      loginUrl,
      lmsId: "TEST",
    };
  }

  if (lead.convertedToStudent && lead.studentId) {
    const [student] = await db
      .select({ lmsId: users.lmsId })
      .from(users)
      .where(eq(users.id, lead.studentId))
      .limit(1);
    return {
      studentId: lead.studentId,
      created: false,
      emailSent: false,
      username: generateUsername(lead.fullName),
      loginUrl,
      lmsId: student?.lmsId ?? "—",
    };
  }

  const email = lead.email.trim().toLowerCase();
  const username = generateUsername(lead.fullName);
  const recordCourseId = lead.courseId;

  let studentId = "";
  let lmsId = "";
  let created = false;
  let plainPassword = "";
  let shouldEmail = apiKey?.sendWelcomeEmail !== false;

  await db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      studentId = existingUser.id;
      const needsReactivation = existingUser.deletedAt !== null || !existingUser.isActive;

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

      if (!enrollment) {
        plainPassword = generateStudentPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 12);
        await tx.insert(studentCourses).values({
          studentId,
          recordCourseId,
          liveCourseId: null,
          batchId: null,
          organisationId: null,
          enrollmentSource: "widget",
        });
        await tx
          .update(users)
          .set({
            ...(needsReactivation
              ? {
                  deletedAt: null,
                  isActive: true,
                  name: lead.fullName,
                  phone: lead.phone,
                  collegeName: lead.college ?? existingUser.collegeName,
                  role: "student",
                }
              : {}),
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(users.id, studentId));
        lmsId = existingUser.lmsId ?? (await createUniqueLmsId());
        if (!existingUser.lmsId) {
          await tx
            .update(users)
            .set({ lmsId, updatedAt: new Date() })
            .where(eq(users.id, studentId));
        }
      } else if (!enrollment.isActive) {
        plainPassword = generateStudentPassword();
        const hashedPassword = await bcrypt.hash(plainPassword, 12);
        await tx
          .update(studentCourses)
          .set({
            isActive: true,
            status: "active",
            revokedAt: null,
            revokeReason: null,
            updatedAt: new Date(),
          })
          .where(eq(studentCourses.id, enrollment.id));
        await tx
          .update(users)
          .set({
            ...(needsReactivation
              ? {
                  deletedAt: null,
                  isActive: true,
                  name: lead.fullName,
                  phone: lead.phone,
                  collegeName: lead.college ?? existingUser.collegeName,
                  role: "student",
                }
              : {}),
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(users.id, studentId));
        lmsId = existingUser.lmsId ?? (await createUniqueLmsId());
        if (!existingUser.lmsId) {
          await tx
            .update(users)
            .set({ lmsId, updatedAt: new Date() })
            .where(eq(users.id, studentId));
        }
      } else {
        lmsId = existingUser.lmsId ?? (await createUniqueLmsId());
        if (!existingUser.lmsId) {
          await tx
            .update(users)
            .set({ lmsId, updatedAt: new Date() })
            .where(eq(users.id, studentId));
        }
        if (needsReactivation) {
          plainPassword = generateStudentPassword();
          const hashedPassword = await bcrypt.hash(plainPassword, 12);
          await tx
            .update(users)
            .set({
              deletedAt: null,
              isActive: true,
              name: lead.fullName,
              phone: lead.phone,
              collegeName: lead.college ?? existingUser.collegeName,
              role: "student",
              password: hashedPassword,
              updatedAt: new Date(),
            })
            .where(eq(users.id, studentId));
        } else {
          shouldEmail = false;
          plainPassword = "";
        }
      }
    } else {
      plainPassword = generateStudentPassword();
      lmsId = await createUniqueLmsId();
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const [student] = await tx
        .insert(users)
        .values({
          name: lead.fullName,
          email,
          phone: lead.phone,
          password: hashedPassword,
          role: "student",
          lmsId,
          organisationId: null,
          collegeName: lead.college ?? null,
        })
        .returning();

      await tx.insert(studentCourses).values({
        studentId: student.id,
        recordCourseId,
        liveCourseId: null,
        batchId: null,
        organisationId: null,
        enrollmentSource: "widget",
      });

      studentId = student.id;
      created = true;
    }

    await tx
      .update(widgetLeads)
      .set({
        convertedToStudent: true,
        studentId,
        status: "converted",
        paymentStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(widgetLeads.id, lead.id));
  });

  const [course] = await db
    .select({ title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, recordCourseId))
    .limit(1);

  let emailSent = false;
  if (shouldEmail && plainPassword) {
    try {
      await sendPartnerStudentCredentialsEmail({
        to: email,
        name: lead.fullName,
        courseTitle: course?.title ?? lead.courseName,
        lmsId,
        password: plainPassword,
        username,
      });
      emailSent = true;
    } catch (err) {
      console.error("[widget-student] email failed:", err);
    }
  }

  await logAction({
    action: created ? "WIDGET_STUDENT_CREATED" : "WIDGET_STUDENT_ENROLLED",
    entity: "WidgetLead",
    entityId: lead.id,
    metadata: { studentId, emailSent, username },
    ipAddress: options?.ipAddress,
  });

  return {
    studentId,
    created,
    emailSent,
    username,
    loginUrl,
    lmsId,
  };
}

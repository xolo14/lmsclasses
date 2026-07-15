import { randomUUID } from "crypto";
import { and, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  certificateTemplates,
  issuedCertificates,
  liveCourses,
  organisations,
  recordCourses,
  studentCourses,
  users,
} from "@/lib/db/schema";
import { logAction } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";
import { sendCertificateEmail } from "@/lib/email";
import { saveCertificatePdf, readCertificatePdf } from "@/lib/certificate-storage";
import {
  getDurationEligibleAt,
  isEnrollmentDurationComplete,
} from "@/lib/certificate-duration";
import { generateCertificatePdf, type TokenData } from "@/lib/services/certificatePdf";
import type { TemplateLayout } from "@/lib/types/certificate";
import { nanoid } from "nanoid";
import { isDirectPlatformStudent } from "@/lib/enrollment-service";

export type CertActor = {
  userId: string;
  role: string;
  name: string;
  organisationId: string | null;
  ipAddress?: string;
};

export class CertificateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateConflictError";
  }
}

function isSuperAdmin(role: string) {
  return role === "super_admin";
}

function isOrgAdmin(role: string) {
  return role === "org_admin";
}

function canManageCerts(role: string) {
  return role === "super_admin" || role === "org_admin";
}

export const ORG_STUDENT_ORG_ADMIN_ONLY_MSG =
  "Organisation students can only receive certificates issued by their org admin.";

type AutoIssueTemplate = typeof certificateTemplates.$inferSelect;

/** Global auto-issue applies to direct students only; org students use their org template. */
function selectAutoIssueTemplate(
  templates: AutoIssueTemplate[],
  studentOrgId: string | null
): AutoIssueTemplate | null {
  if (studentOrgId) {
    return templates.find((t) => t.orgId === studentOrgId) ?? null;
  }
  return templates.find((t) => t.orgId === null) ?? null;
}

/** One active certificate per student per course (any template). */
async function findActiveCertificateForCourse(
  studentId: string,
  courseId: string,
  courseType: "live" | "record"
) {
  const [existing] = await db
    .select({
      id: issuedCertificates.id,
      certificateNumber: issuedCertificates.certificateNumber,
    })
    .from(issuedCertificates)
    .where(
      and(
        eq(issuedCertificates.studentId, studentId),
        eq(issuedCertificates.courseId, courseId),
        eq(issuedCertificates.courseType, courseType),
        eq(issuedCertificates.isRevoked, false)
      )
    )
    .limit(1);
  return existing ?? null;
}

async function getCourseName(courseId: string, courseType: "live" | "record") {
  if (courseType === "live") {
    const [row] = await db
      .select({ title: liveCourses.title, level: liveCourses.level })
      .from(liveCourses)
      .where(eq(liveCourses.id, courseId))
      .limit(1);
    return { name: row?.title ?? "Course", domain: row?.level ?? "General" };
  }
  const [row] = await db
    .select({ title: recordCourses.title, level: recordCourses.level })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);
  return { name: row?.title ?? "Course", domain: row?.level ?? "General" };
}

async function getCourseDuration(courseId: string, courseType: "live" | "record") {
  if (courseType === "live") {
    const [row] = await db
      .select({ duration: liveCourses.duration })
      .from(liveCourses)
      .where(eq(liveCourses.id, courseId))
      .limit(1);
    return row?.duration ?? null;
  }
  const [row] = await db
    .select({ duration: recordCourses.duration })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);
  return row?.duration ?? null;
}

async function nextCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LMS-${year}-`;
  const [row] = await db
    .select({ certificateNumber: issuedCertificates.certificateNumber })
    .from(issuedCertificates)
    .where(ilike(issuedCertificates.certificateNumber, `${prefix}%`))
    .orderBy(desc(issuedCertificates.certificateNumber))
    .limit(1);

  let seq = 1;
  if (row?.certificateNumber) {
    const part = row.certificateNumber.replace(prefix, "");
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

function formatIssueDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortStudentId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function assertTemplateAccess(templateId: string, actor: CertActor) {
  const [template] = await db
    .select()
    .from(certificateTemplates)
    .where(eq(certificateTemplates.id, templateId))
    .limit(1);
  if (!template) throw new Error("Template not found");
  if (isSuperAdmin(actor.role)) return template;
  if (isOrgAdmin(actor.role) && actor.organisationId) {
    if (template.orgId === null || template.orgId === actor.organisationId) return template;
  }
  throw new Error("Forbidden");
}

async function unsetDefaultForCourse(
  orgId: string | null,
  courseId: string | null,
  courseType: "live" | "record" | null
) {
  if (!courseId || !courseType) return;
  const conditions = [
    eq(certificateTemplates.courseId, courseId),
    eq(certificateTemplates.courseType, courseType),
    eq(certificateTemplates.isDefault, true),
  ];
  if (orgId) {
    conditions.push(eq(certificateTemplates.orgId, orgId));
  } else {
    conditions.push(isNull(certificateTemplates.orgId));
  }
  await db
    .update(certificateTemplates)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(...conditions));
}

function cloneLayoutWithNewIds(layout: TemplateLayout): TemplateLayout {
  const cloned: TemplateLayout = JSON.parse(JSON.stringify(layout));
  cloned.elements = cloned.elements.map((el) => ({ ...el, id: nanoid() }));
  return cloned;
}

export async function createTemplate(
  actor: CertActor,
  input: {
    name: string;
    courseId?: string;
    courseType?: "live" | "record";
    layout: TemplateLayout;
    autoIssue: boolean;
    isDefault: boolean;
  }
) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const orgId = isOrgAdmin(actor.role) ? actor.organisationId : null;
  if (isOrgAdmin(actor.role) && !orgId) throw new Error("Organisation not found");
  if (input.autoIssue && (!input.courseId || !input.courseType)) {
    throw new Error("Link a course to this template to enable auto-issue");
  }

  if (input.isDefault && input.courseId && input.courseType) {
    await unsetDefaultForCourse(orgId, input.courseId, input.courseType);
  }

  const [template] = await db
    .insert(certificateTemplates)
    .values({
      createdBy: actor.userId,
      orgId,
      courseId: input.courseId ?? null,
      courseType: input.courseType ?? null,
      name: input.name,
      layout: input.layout,
      autoIssue: input.autoIssue,
      isDefault: input.isDefault,
    })
    .returning();

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate_template.created",
    entity: "CertificateTemplate",
    entityId: template.id,
    metadata: { name: input.name },
    ipAddress: actor.ipAddress,
  });

  return { templateId: template.id };
}

export async function updateTemplate(
  actor: CertActor,
  templateId: string,
  input: Partial<{
    name: string;
    courseId: string | null;
    courseType: "live" | "record" | null;
    layout: TemplateLayout;
    autoIssue: boolean;
    isDefault: boolean;
    isActive: boolean;
  }>
) {
  const existing = await assertTemplateAccess(templateId, actor);
  if (!isSuperAdmin(actor.role) && existing.orgId === null) {
    throw new Error("Cannot edit global templates");
  }

  const nextAutoIssue = input.autoIssue ?? existing.autoIssue;
  const nextCourseId = input.courseId !== undefined ? input.courseId : existing.courseId;
  const nextCourseType = input.courseType !== undefined ? input.courseType : existing.courseType;
  if (nextAutoIssue && (!nextCourseId || !nextCourseType)) {
    throw new Error("Link a course to this template to enable auto-issue");
  }

  if (input.isDefault && (input.courseId ?? existing.courseId)) {
    await unsetDefaultForCourse(
      existing.orgId,
      input.courseId ?? existing.courseId,
      input.courseType ?? existing.courseType
    );
  }

  await db
    .update(certificateTemplates)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(certificateTemplates.id, templateId));

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate_template.updated",
    entity: "CertificateTemplate",
    entityId: templateId,
    ipAddress: actor.ipAddress,
  });
}

export async function deleteTemplate(actor: CertActor, templateId: string) {
  const existing = await assertTemplateAccess(templateId, actor);
  if (!isSuperAdmin(actor.role) && existing.orgId === null) {
    throw new Error("Cannot delete global templates");
  }

  const [used] = await db
    .select({ c: count() })
    .from(issuedCertificates)
    .where(
      and(eq(issuedCertificates.templateId, templateId), eq(issuedCertificates.isRevoked, false))
    );
  if ((used?.c ?? 0) > 0) {
    throw new Error("Cannot delete template with active issued certificates");
  }

  await db.delete(certificateTemplates).where(eq(certificateTemplates.id, templateId));

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate_template.deleted",
    entity: "CertificateTemplate",
    entityId: templateId,
    ipAddress: actor.ipAddress,
  });
}

export async function duplicateTemplate(actor: CertActor, templateId: string, newName: string) {
  const existing = await assertTemplateAccess(templateId, actor);
  const result = await createTemplate(actor, {
    name: newName,
    courseId: existing.courseId ?? undefined,
    courseType: existing.courseType ?? undefined,
    layout: cloneLayoutWithNewIds(existing.layout as TemplateLayout),
    autoIssue: existing.autoIssue,
    isDefault: false,
  });
  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate_template.duplicated",
    entity: "CertificateTemplate",
    entityId: result.templateId,
    metadata: { sourceTemplateId: templateId },
    ipAddress: actor.ipAddress,
  });
  return result;
}

export async function listTemplates(
  actor: CertActor,
  filters?: { courseId?: string; isActive?: boolean; search?: string }
) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const conditions = [];
  if (filters?.isActive !== undefined) {
    conditions.push(eq(certificateTemplates.isActive, filters.isActive));
  }
  if (filters?.courseId) {
    conditions.push(eq(certificateTemplates.courseId, filters.courseId));
  }
  if (filters?.search) {
    conditions.push(ilike(certificateTemplates.name, `%${filters.search}%`));
  }

  if (isOrgAdmin(actor.role) && actor.organisationId) {
    conditions.push(
      or(
        eq(certificateTemplates.orgId, actor.organisationId),
        isNull(certificateTemplates.orgId)
      )!
    );
  }

  const rows = await db
    .select({
      template: certificateTemplates,
      issueCount: sql<number>`(
        SELECT count(*)::int FROM issued_certificates ic
        WHERE ic.template_id = ${certificateTemplates.id}
        AND ic.is_revoked = false
      )`,
      orgName: organisations.name,
      creatorName: users.name,
      courseTitle: sql<string | null>`CASE
        WHEN ${certificateTemplates.courseType} = 'live' THEN (
          SELECT title FROM live_courses WHERE id = ${certificateTemplates.courseId}
        )
        WHEN ${certificateTemplates.courseType} = 'record' THEN (
          SELECT title FROM record_courses WHERE id = ${certificateTemplates.courseId}
        )
        ELSE NULL
      END`,
    })
    .from(certificateTemplates)
    .leftJoin(organisations, eq(certificateTemplates.orgId, organisations.id))
    .leftJoin(users, eq(certificateTemplates.createdBy, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(certificateTemplates.updatedAt));

  return rows.map((r) => ({
    ...r.template,
    issueCount: r.issueCount ?? 0,
    orgName: r.orgName,
    creatorName: r.creatorName,
    courseTitle: r.courseTitle,
    isGlobal: r.template.orgId === null,
    canEdit: isSuperAdmin(actor.role) || r.template.orgId === actor.organisationId,
  }));
}

export async function getTemplate(actor: CertActor, templateId: string) {
  const template = await assertTemplateAccess(templateId, actor);
  return template;
}

export async function issueCertificate(
  actor: CertActor,
  input: {
    templateId: string;
    studentId: string;
    courseId: string;
    courseType: "live" | "record";
    enrollmentId?: string;
  }
) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const template = await assertTemplateAccess(input.templateId, actor);

  if (template.courseId && template.courseId !== input.courseId) {
    throw new Error("Template is linked to a different course");
  }
  if (template.courseType && template.courseType !== input.courseType) {
    throw new Error("Template course type does not match");
  }

  const existing = await findActiveCertificateForCourse(
    input.studentId,
    input.courseId,
    input.courseType
  );

  if (existing) {
    throw new CertificateConflictError(
      `Certificate already issued for this course: ${existing.certificateNumber}`
    );
  }

  const [student] = await db
    .select({
      name: users.name,
      email: users.email,
      organisationId: users.organisationId,
      lmsId: users.lmsId,
    })
    .from(users)
    .where(eq(users.id, input.studentId))
    .limit(1);
  if (!student) throw new Error("Student not found");

  if (isSuperAdmin(actor.role) && !isDirectPlatformStudent(student)) {
    throw new Error(ORG_STUDENT_ORG_ADMIN_ONLY_MSG);
  }
  if (isOrgAdmin(actor.role) && actor.organisationId) {
    if (student.organisationId !== actor.organisationId) {
      throw new Error("Forbidden");
    }
  }

  let enrollmentId = input.enrollmentId;
  if (enrollmentId) {
    const [enrollment] = await db
      .select({
        completedAt: studentCourses.completedAt,
        studentId: studentCourses.studentId,
        liveCourseId: studentCourses.liveCourseId,
        recordCourseId: studentCourses.recordCourseId,
        isActive: studentCourses.isActive,
      })
      .from(studentCourses)
      .where(eq(studentCourses.id, enrollmentId))
      .limit(1);
    if (!enrollment || enrollment.studentId !== input.studentId) {
      throw new Error("Enrollment does not belong to this student");
    }
    const enrollmentCourseId =
      input.courseType === "live" ? enrollment.liveCourseId : enrollment.recordCourseId;
    if (enrollmentCourseId !== input.courseId) {
      throw new Error("Enrollment does not match this course");
    }
    if (!enrollment.isActive) {
      throw new Error("Enrollment is not active");
    }
  } else {
    const [enrollment] = await db
      .select({ id: studentCourses.id, completedAt: studentCourses.completedAt })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, input.studentId),
          eq(studentCourses.isActive, true),
          input.courseType === "live"
            ? eq(studentCourses.liveCourseId, input.courseId)
            : eq(studentCourses.recordCourseId, input.courseId)
        )
      )
      .limit(1);
    if (!enrollment) {
      throw new Error("Student is not enrolled in this course");
    }
    enrollmentId = enrollment.id;
  }

  const lmsId = student.lmsId?.trim() || shortStudentId(input.studentId);

  const { name: courseName, domain } = await getCourseName(input.courseId, input.courseType);

  let orgName: string | null = null;
  const orgId = student.organisationId ?? template.orgId;
  if (orgId) {
    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    orgName = org?.name ?? null;
  }

  let completionDate = formatIssueDate(new Date());
  const [enrollmentRow] = await db
    .select({ completedAt: studentCourses.completedAt })
    .from(studentCourses)
    .where(eq(studentCourses.id, enrollmentId))
    .limit(1);
  if (enrollmentRow?.completedAt) {
    completionDate = formatIssueDate(enrollmentRow.completedAt);
  }

  // Final race-safe check before generating PDF/number
  const raced = await findActiveCertificateForCourse(
    input.studentId,
    input.courseId,
    input.courseType
  );
  if (raced) {
    throw new CertificateConflictError(
      `Certificate already issued for this course: ${raced.certificateNumber}`
    );
  }

  let cert: typeof issuedCertificates.$inferSelect | undefined;
  let certificateNumber = "";
  let pdfBuffer: Buffer = Buffer.alloc(0);
  let diskPath = "";
  let url = "";
  const verificationToken = randomUUID();
  const issuedAt = new Date();
  const verifyUrl = `${getAppUrl()}/verify/${verificationToken}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    certificateNumber = await nextCertificateNumber();
    const tokenData: TokenData = {
      studentName: student.name,
      lmsId,
      studentId: lmsId,
      courseName,
      domain,
      orgName: orgName ?? "LMS Classes",
      certificateNumber,
      issueDate: formatIssueDate(issuedAt),
      completionDate,
      verifyUrl,
    };

    pdfBuffer = await generateCertificatePdf(template.layout as TemplateLayout, tokenData);
    ({ diskPath, url } = await saveCertificatePdf(certificateNumber, pdfBuffer));

    try {
      const [inserted] = await db
        .insert(issuedCertificates)
        .values({
          certificateNumber,
          templateId: input.templateId,
          studentId: input.studentId,
          courseId: input.courseId,
          courseType: input.courseType,
          orgId,
          enrollmentId: enrollmentId,
          studentNameSnapshot: student.name,
          courseNameSnapshot: courseName,
          orgNameSnapshot: orgName,
          issuedByNameSnapshot: actor.name,
          domainSnapshot: domain,
          pdfUrl: url,
          pdfStoragePath: diskPath,
          pdfData: null,
          verificationToken,
          issuedAt,
        })
        .returning();
      cert = inserted;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isUnique =
        /unique|duplicate|23505/i.test(msg) ||
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "23505");
      if (!isUnique || attempt === 4) throw err;

      const again = await findActiveCertificateForCourse(
        input.studentId,
        input.courseId,
        input.courseType
      );
      if (again) {
        throw new CertificateConflictError(
          `Certificate already issued for this course: ${again.certificateNumber}`
        );
      }
      // certificate_number collision — retry with next number
    }
  }

  if (!cert) throw new Error("Failed to issue certificate");

  let emailError: string | undefined;
  if (student.email) {
    try {
      await sendCertificateEmail({
        to: student.email,
        studentName: student.name,
        courseName,
        certificateNumber,
        verifyUrl,
        pdfBuffer,
        pdfFilename: `${certificateNumber}.pdf`,
      });
      await db
        .update(issuedCertificates)
        .set({ emailSentAt: new Date(), emailSentTo: student.email })
        .where(eq(issuedCertificates.id, cert.id));
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Email failed";
      console.error("[certificate] email failed:", emailError);
    }
  }

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate.issued",
    entity: "IssuedCertificate",
    entityId: cert.id,
    metadata: { certificateNumber, studentId: input.studentId, emailError },
    ipAddress: actor.ipAddress,
  });

  return { certificateId: cert.id, certificateNumber, emailError };
}

export async function bulkIssueCertificates(
  actor: CertActor,
  input: {
    templateId: string;
    studentIds: string[];
    courseId: string;
    courseType: "live" | "record";
  }
) {
  const issued: string[] = [];
  const skipped: string[] = [];
  const failed: { studentId: string; message: string }[] = [];

  for (const studentId of input.studentIds) {
    try {
      const [enrollment] = await db
        .select({ id: studentCourses.id })
        .from(studentCourses)
        .where(
          and(
            eq(studentCourses.studentId, studentId),
            eq(studentCourses.isActive, true),
            input.courseType === "live"
              ? eq(studentCourses.liveCourseId, input.courseId)
              : eq(studentCourses.recordCourseId, input.courseId)
          )
        )
        .limit(1);

      await issueCertificate(actor, {
        templateId: input.templateId,
        studentId,
        courseId: input.courseId,
        courseType: input.courseType,
        enrollmentId: enrollment?.id,
      });
      issued.push(studentId);
    } catch (err) {
      if (err instanceof CertificateConflictError) {
        skipped.push(studentId);
      } else {
        failed.push({
          studentId,
          message: err instanceof Error ? err.message : "Issue failed",
        });
        console.error("[certificate] bulk issue failed:", studentId, err);
      }
    }
  }

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate.bulk_issued",
    entity: "IssuedCertificate",
    metadata: { issued: issued.length, skipped: skipped.length, failed: failed.length },
    ipAddress: actor.ipAddress,
  });

  return { issued, skipped, failed };
}

export async function resendCertificateEmail(actor: CertActor, certificateId: string) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const cert = await getCertificateForActor(actor, certificateId);
  if (!cert.emailSentTo && !cert.studentId) throw new Error("No email on file");

  const [student] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, cert.studentId))
    .limit(1);
  const email = student?.email;
  if (!email) throw new Error("Student email not found");

  const pdfBuffer = await readCertificatePdf(cert);
  const verifyUrl = `${getAppUrl()}/verify/${cert.verificationToken}`;

  await sendCertificateEmail({
    to: email,
    studentName: cert.studentNameSnapshot,
    courseName: cert.courseNameSnapshot,
    certificateNumber: cert.certificateNumber,
    verifyUrl,
    pdfBuffer,
    pdfFilename: `${cert.certificateNumber}.pdf`,
  });

  await db
    .update(issuedCertificates)
    .set({
      emailSentAt: new Date(),
      emailSentTo: email,
      emailResendCount: sql`${issuedCertificates.emailResendCount} + 1`,
    })
    .where(eq(issuedCertificates.id, certificateId));

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate.email_resent",
    entity: "IssuedCertificate",
    entityId: certificateId,
    ipAddress: actor.ipAddress,
  });
}

export async function revokeCertificate(
  actor: CertActor,
  certificateId: string,
  reason: string
) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const cert = await getCertificateForActor(actor, certificateId);
  if (isOrgAdmin(actor.role)) {
    if (!actor.organisationId || cert.orgId !== actor.organisationId) {
      throw new Error("Forbidden");
    }
  }

  await db
    .update(issuedCertificates)
    .set({
      isRevoked: true,
      revokeReason: reason,
      revokedAt: new Date(),
      revokedBy: actor.userId,
    })
    .where(eq(issuedCertificates.id, certificateId));

  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate.revoked",
    entity: "IssuedCertificate",
    entityId: certificateId,
    metadata: { reason },
    ipAddress: actor.ipAddress,
  });
}

async function getCertificateForActor(actor: CertActor, certificateId: string) {
  const [cert] = await db
    .select()
    .from(issuedCertificates)
    .where(eq(issuedCertificates.id, certificateId))
    .limit(1);
  if (!cert) throw new Error("Certificate not found");

  if (isSuperAdmin(actor.role)) return cert;
  if (actor.role === "student") {
    if (cert.studentId !== actor.userId) throw new Error("Forbidden");
    return cert;
  }
  if (isOrgAdmin(actor.role)) {
    if (!actor.organisationId || cert.orgId !== actor.organisationId) {
      throw new Error("Forbidden");
    }
    return cert;
  }
  throw new Error("Forbidden");
}

export async function listIssuedCertificates(
  actor: CertActor,
  filters?: {
    studentId?: string;
    courseId?: string;
    templateId?: string;
    isRevoked?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = filters?.page ?? 1;
  const limit = Math.min(filters?.limit ?? 50, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters?.studentId) conditions.push(eq(issuedCertificates.studentId, filters.studentId));
  if (filters?.courseId) conditions.push(eq(issuedCertificates.courseId, filters.courseId));
  if (filters?.templateId) conditions.push(eq(issuedCertificates.templateId, filters.templateId));
  if (filters?.isRevoked !== undefined) {
    conditions.push(eq(issuedCertificates.isRevoked, filters.isRevoked));
  }
  if (filters?.dateFrom) conditions.push(gte(issuedCertificates.issuedAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(issuedCertificates.issuedAt, filters.dateTo));
  if (filters?.search) {
    conditions.push(
      or(
        ilike(issuedCertificates.studentNameSnapshot, `%${filters.search}%`),
        ilike(issuedCertificates.certificateNumber, `%${filters.search}%`)
      )!
    );
  }

  if (actor.role === "student") {
    conditions.push(eq(issuedCertificates.studentId, actor.userId));
  } else if (isOrgAdmin(actor.role) && actor.organisationId) {
    conditions.push(eq(issuedCertificates.orgId, actor.organisationId));
  } else if (!isSuperAdmin(actor.role)) {
    throw new Error("Unauthorized");
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ c: count() }).from(issuedCertificates).where(where);

  const rows = await db
    .select({
      cert: issuedCertificates,
      templateName: certificateTemplates.name,
    })
    .from(issuedCertificates)
    .leftJoin(certificateTemplates, eq(issuedCertificates.templateId, certificateTemplates.id))
    .where(where)
    .orderBy(desc(issuedCertificates.issuedAt))
    .limit(limit)
    .offset(offset);

  return {
    certificates: rows.map((r) => ({
      ...r.cert,
      templateName: r.templateName,
    })),
    total: totalRow?.c ?? 0,
  };
}

export async function getCertificatePdfBuffer(actor: CertActor, certificateId: string) {
  const cert = await getCertificateForActor(actor, certificateId);
  const buffer = await readCertificatePdf(cert);
  await logAction({
    userId: actor.userId,
    role: actor.role as any,
    action: "certificate.downloaded",
    entity: "IssuedCertificate",
    entityId: certificateId,
    ipAddress: actor.ipAddress,
  });
  return {
    buffer,
    filename: `${cert.certificateNumber}.pdf`,
    cert,
  };
}

export async function getVerificationByToken(token: string) {
  const [cert] = await db
    .select()
    .from(issuedCertificates)
    .where(eq(issuedCertificates.verificationToken, token))
    .limit(1);
  return cert ?? null;
}

export async function getCertificateAnalytics(actor: CertActor) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const orgFilter =
    isOrgAdmin(actor.role) && actor.organisationId
      ? eq(issuedCertificates.orgId, actor.organisationId)
      : undefined;

  const monthly = await db
    .select({
      month: sql<string>`to_char(${issuedCertificates.issuedAt}, 'Mon YY')`,
      count: sql<number>`count(*)::int`,
    })
    .from(issuedCertificates)
    .where(orgFilter)
    .groupBy(sql`to_char(${issuedCertificates.issuedAt}, 'Mon YY')`, sql`date_trunc('month', ${issuedCertificates.issuedAt})`)
    .orderBy(sql`date_trunc('month', ${issuedCertificates.issuedAt})`)
    .limit(12);

  const byCourse = await db
    .select({
      courseName: issuedCertificates.courseNameSnapshot,
      count: sql<number>`count(*)::int`,
    })
    .from(issuedCertificates)
    .where(orgFilter)
    .groupBy(issuedCertificates.courseNameSnapshot)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      revoked: sql<number>`count(*) filter (where ${issuedCertificates.isRevoked})::int`,
    })
    .from(issuedCertificates)
    .where(orgFilter);

  return { monthly, byCourse, totals: totals ?? { total: 0, revoked: 0 } };
}

export async function checkAndAutoIssueForEnrollment(enrollmentId: string) {
  const [enrollment] = await db
    .select()
    .from(studentCourses)
    .where(eq(studentCourses.id, enrollmentId))
    .limit(1);
  if (!enrollment || !enrollment.isActive) return false;

  const courseId = enrollment.recordCourseId ?? enrollment.liveCourseId;
  const courseType = enrollment.recordCourseId ? ("record" as const) : ("live" as const);
  if (!courseId) return false;

  const duration = await getCourseDuration(courseId, courseType);
  if (!isEnrollmentDurationComplete(enrollment.enrolledAt, duration)) return false;

  const [student] = await db
    .select({ organisationId: users.organisationId })
    .from(users)
    .where(eq(users.id, enrollment.studentId))
    .limit(1);
  if (!student) return false;

  const templates = await db
    .select()
    .from(certificateTemplates)
    .where(
      and(
        eq(certificateTemplates.courseId, courseId),
        eq(certificateTemplates.courseType, courseType),
        eq(certificateTemplates.autoIssue, true),
        eq(certificateTemplates.isActive, true)
      )
    );

  const template = selectAutoIssueTemplate(templates, student.organisationId);
  if (!template) return false;

  const existing = await findActiveCertificateForCourse(
    enrollment.studentId,
    courseId,
    courseType
  );
  if (existing) return false;

  const actor: CertActor = {
    userId: template.createdBy,
    role: template.orgId ? "org_admin" : "super_admin",
    name: "System",
    organisationId: template.orgId ?? null,
  };

  try {
    await issueCertificate(actor, {
      templateId: template.id,
      studentId: enrollment.studentId,
      courseId,
      courseType,
      enrollmentId,
    });
    return true;
  } catch (err) {
    if (!(err instanceof CertificateConflictError)) {
      console.error("[certificate] auto-issue failed:", err);
    }
    return false;
  }
}

export async function triggerAutoIssuance(enrollmentId: string) {
  await checkAndAutoIssueForEnrollment(enrollmentId);
}

export async function processPendingAutoIssuances(scopeOrgId?: string | null) {
  const templateConditions = [
    eq(certificateTemplates.autoIssue, true),
    eq(certificateTemplates.isActive, true),
    sql`${certificateTemplates.courseId} IS NOT NULL`,
    sql`${certificateTemplates.courseType} IS NOT NULL`,
  ];
  if (scopeOrgId) {
    templateConditions.push(eq(certificateTemplates.orgId, scopeOrgId));
  }

  const templates = await db
    .select()
    .from(certificateTemplates)
    .where(and(...templateConditions));

  let issued = 0;
  const durationCache = new Map<string, string | null>();

  for (const template of templates) {
    if (!template.courseId || !template.courseType) continue;
    const cacheKey = `${template.courseType}:${template.courseId}`;
    let duration = durationCache.get(cacheKey);
    if (duration === undefined) {
      duration = await getCourseDuration(template.courseId, template.courseType);
      durationCache.set(cacheKey, duration);
    }

    const enrollments = await db
      .select()
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.isActive, true),
          template.courseType === "live"
            ? eq(studentCourses.liveCourseId, template.courseId)
            : eq(studentCourses.recordCourseId, template.courseId)
        )
      );

    for (const enrollment of enrollments) {
      if (!isEnrollmentDurationComplete(enrollment.enrolledAt, duration)) continue;
      const ok = await checkAndAutoIssueForEnrollment(enrollment.id);
      if (ok) issued += 1;
    }
  }

  return { issued };
}

export async function processStudentAutoIssuances(studentId: string) {
  const enrollments = await db
    .select({ id: studentCourses.id })
    .from(studentCourses)
    .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.isActive, true)));

  let issued = 0;
  for (const enrollment of enrollments) {
    const ok = await checkAndAutoIssueForEnrollment(enrollment.id);
    if (ok) issued += 1;
  }
  return { issued };
}

export async function listEnrolledStudentsForCourse(
  actor: CertActor,
  courseId: string,
  courseType: "live" | "record",
  templateId?: string,
  options?: { eligibleOnly?: boolean }
) {
  if (!canManageCerts(actor.role)) throw new Error("Unauthorized");

  const conditions = [
    eq(studentCourses.isActive, true),
    courseType === "live"
      ? eq(studentCourses.liveCourseId, courseId)
      : eq(studentCourses.recordCourseId, courseId),
  ];
  if (isOrgAdmin(actor.role) && actor.organisationId) {
    conditions.push(eq(users.organisationId, actor.organisationId));
  }

  if (templateId) {
    const [template] = await db
      .select({ orgId: certificateTemplates.orgId })
      .from(certificateTemplates)
      .where(eq(certificateTemplates.id, templateId))
      .limit(1);
    if (isSuperAdmin(actor.role)) {
      if (template?.orgId === null) {
        // Global template: only direct (non-org) students
        conditions.push(isNull(users.organisationId));
      } else if (template?.orgId) {
        // Org templates are issued by org admins only — super admin sees no eligible students
        return [];
      }
    }
  }

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      enrolledAt: studentCourses.enrolledAt,
      completionPercentage: studentCourses.completionPercentage,
      enrollmentId: studentCourses.id,
    })
    .from(studentCourses)
    .innerJoin(users, eq(studentCourses.studentId, users.id))
    .where(and(...conditions));

  if (!templateId) return students;

  const existing = await db
    .select({ studentId: issuedCertificates.studentId })
    .from(issuedCertificates)
    .where(
      and(
        eq(issuedCertificates.courseId, courseId),
        eq(issuedCertificates.courseType, courseType),
        eq(issuedCertificates.isRevoked, false)
      )
    );

  const hasCert = new Set(existing.map((e) => e.studentId));
  const duration = await getCourseDuration(courseId, courseType);
  const mapped = students.map((s) => ({
    ...s,
    alreadyHasCert: hasCert.has(s.id),
    durationEligible: isEnrollmentDurationComplete(s.enrolledAt, duration),
    eligibleAt: getDurationEligibleAt(s.enrolledAt, duration)?.toISOString() ?? null,
  }));

  if (options?.eligibleOnly) {
    return mapped.filter((s) => !s.alreadyHasCert);
  }
  return mapped;
}

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  courseRecordings,
  liveClasses,
  liveCourses,
  organisations,
  recordCourses,
  recordedModuleProgress,
  slots,
  studentCourses,
  users,
  type EnrollmentAccessType,
  type EnrollmentStatus,
  type LiveCourse,
  type RecordCourse,
} from "@/lib/db/schema";
import type { AssignCoursesInput, UpdateEnrollmentInput } from "@/lib/validations/enrollment";
import { logAction } from "@/lib/audit";

/** Super admin may assign extra courses only to direct/platform students (no organisation). */
export function isDirectPlatformStudent(student: { organisationId: string | null }): boolean {
  return !student.organisationId;
}

export const SUPER_ADMIN_DIRECT_STUDENT_ONLY_MSG =
  "Super admin can only assign courses to direct students. Organisation students must be managed by their org admin.";

export type ResolvedCourse = {
  id: string;
  type: "live" | "record";
  title: string;
  slug: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  hasLive: boolean;
  hasRecorded: boolean;
  price: string;
  liveCourse?: LiveCourse;
  recordCourse?: RecordCourse;
};

export type EnrollmentWithCourse = {
  id: string;
  studentId: string;
  courseId: string;
  courseType: "live" | "record";
  courseTitle: string;
  courseSlug: string | null;
  courseThumbnail: string | null;
  accessType: EnrollmentAccessType;
  liveAccess: boolean;
  recordedAccess: boolean;
  batchId: string | null;
  organisationId: string | null;
  status: EnrollmentStatus;
  completionPercentage: number;
  liveClassesAttended: number;
  recordedModulesWatched: number;
  totalModules: number;
  certificate: boolean;
  enrolledAt: Date | null;
  lastAccessedAt: Date | null;
  nextLiveClassAt: Date | null;
};

type Actor = {
  userId: string;
  role: string;
  organisationId?: string | null;
  ipAddress?: string;
};

export async function resolveCourse(courseId: string): Promise<ResolvedCourse | null> {
  const [live] = await db.select().from(liveCourses).where(eq(liveCourses.id, courseId)).limit(1);
  if (live) {
    return {
      id: live.id,
      type: "live",
      title: live.title,
      slug: live.slug,
      thumbnailUrl: live.thumbnailUrl,
      description: live.description,
      hasLive: live.hasLive ?? true,
      hasRecorded: live.hasRecorded ?? false,
      price: live.price,
      liveCourse: live,
    };
  }
  const [record] = await db.select().from(recordCourses).where(eq(recordCourses.id, courseId)).limit(1);
  if (record) {
    return {
      id: record.id,
      type: "record",
      title: record.title,
      slug: record.slug,
      thumbnailUrl: record.thumbnailUrl,
      description: record.description,
      hasLive: record.hasLive ?? false,
      hasRecorded: record.hasRecorded ?? true,
      price: record.price,
      recordCourse: record,
    };
  }
  return null;
}

export async function getSlotSummary(
  organisationId: string,
  course: ResolvedCourse
): Promise<{ total: number; used: number; remaining: number; slotRows: (typeof slots.$inferSelect)[] }> {
  const slotRows = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.organisationId, organisationId),
        course.type === "live"
          ? eq(slots.courseId, course.id)
          : eq(slots.recordCourseId, course.id)
      )
    );
  const total = slotRows.reduce((s, r) => s + r.totalSlots, 0);
  const used = slotRows.reduce((s, r) => s + (r.usedSlots ?? 0), 0);
  return { total, used, remaining: Math.max(0, total - used), slotRows };
}

async function consumeOneSlot(slotRows: (typeof slots.$inferSelect)[]): Promise<boolean> {
  for (const row of slotRows) {
    const [updated] = await db
      .update(slots)
      .set({ usedSlots: sql`COALESCE(${slots.usedSlots}, 0) + 1` })
      .where(
        and(eq(slots.id, row.id), sql`COALESCE(${slots.usedSlots}, 0) < ${slots.totalSlots}`)
      )
      .returning({ id: slots.id });
    if (updated) return true;
  }
  return false;
}

async function freeOneSlot(
  organisationId: string,
  course: ResolvedCourse
): Promise<void> {
  const condition =
    course.type === "live"
      ? eq(slots.courseId, course.id)
      : eq(slots.recordCourseId, course.id);
  const [row] = await db
    .select()
    .from(slots)
    .where(and(eq(slots.organisationId, organisationId), condition, sql`COALESCE(${slots.usedSlots}, 0) > 0`))
    .limit(1);
  if (row) {
    await db
      .update(slots)
      .set({ usedSlots: sql`GREATEST(COALESCE(${slots.usedSlots}, 0) - 1, 0)` })
      .where(eq(slots.id, row.id));
  }
}

function deriveAccessFlags(
  accessType: EnrollmentAccessType,
  course: ResolvedCourse
): { liveAccess: boolean; recordedAccess: boolean } {
  const liveAccess =
    (accessType === "live" || accessType === "both") && course.hasLive;
  const recordedAccess =
    (accessType === "recorded" || accessType === "both") && course.hasRecorded;
  return { liveAccess, recordedAccess };
}

function validateAccessTypeForCourse(
  accessType: EnrollmentAccessType,
  course: ResolvedCourse
): string | null {
  if (accessType === "live" && !course.hasLive) {
    return `Course "${course.title}" does not support live access`;
  }
  if (accessType === "recorded" && !course.hasRecorded) {
    return `Course "${course.title}" does not support recorded access`;
  }
  if (accessType === "both" && (!course.hasLive || !course.hasRecorded)) {
    return `Course "${course.title}" does not support both live and recorded access`;
  }
  return null;
}

async function findActiveEnrollment(studentId: string, course: ResolvedCourse) {
  const [row] = await db
    .select()
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        course.type === "live"
          ? eq(studentCourses.liveCourseId, course.id)
          : eq(studentCourses.recordCourseId, course.id),
        or(eq(studentCourses.status, "active"), eq(studentCourses.status, "paused"))
      )
    )
    .limit(1);
  return row ?? null;
}

async function findAnyEnrollment(studentId: string, course: ResolvedCourse) {
  const [row] = await db
    .select()
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        course.type === "live"
          ? eq(studentCourses.liveCourseId, course.id)
          : eq(studentCourses.recordCourseId, course.id)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function assignCoursesToStudent(
  input: AssignCoursesInput,
  actor: Actor
): Promise<{ enrolled: string[]; skipped: string[]; errors: string[] }> {
  const enrolled: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const [student] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, input.studentId), eq(users.role, "student"), isNull(users.deletedAt)))
    .limit(1);
  if (!student) {
    return { enrolled: [], skipped: [], errors: ["Student not found"] };
  }

  if (actor.role === "super_admin" && !isDirectPlatformStudent(student)) {
    return { enrolled: [], skipped: [], errors: [SUPER_ADMIN_DIRECT_STUDENT_ONLY_MSG] };
  }

  const orgId = student.organisationId;
  if (!orgId && !input.isFree && actor.role === "org_admin") {
    return { enrolled: [], skipped: [], errors: ["Student has no organisation"] };
  }

  if (actor.role === "org_admin" && actor.organisationId && student.organisationId !== actor.organisationId) {
    return { enrolled: [], skipped: [], errors: ["Cannot assign courses to students outside your organisation"] };
  }

  const isPlatformStaff = actor.role === "super_admin" || actor.role === "manager";
  const now = new Date();
  const liveFrom = input.liveAccessFrom ?? now;
  const recordedFrom = input.recordedAccessFrom ?? now;

  for (const courseId of input.courseIds) {
    const course = await resolveCourse(courseId);
    if (!course) {
      errors.push(`Course ${courseId} not found`);
      continue;
    }

    const accessErr = validateAccessTypeForCourse(input.accessType, course);
    if (accessErr) {
      errors.push(accessErr);
      continue;
    }

    const active = await findActiveEnrollment(input.studentId, course);
    if (active) {
      skipped.push(course.title);
      continue;
    }

    const { liveAccess, recordedAccess } = deriveAccessFlags(input.accessType, course);

    if (liveAccess && course.type === "live" && !input.batchId && actor.role === "org_admin") {
      errors.push(`${course.title}: batch required for live access`);
      continue;
    }

    let slotConsumed = false;
    if (!input.isFree && orgId) {
      const { remaining, slotRows } = await getSlotSummary(orgId, course);
      if (!isPlatformStaff && remaining <= 0) {
        errors.push(`${course.title}: no slots available`);
        continue;
      }
      if (slotRows.length > 0) {
        const ok = await consumeOneSlot(slotRows);
        if (!ok && !isPlatformStaff) {
          errors.push(`${course.title}: failed to consume slot`);
          continue;
        }
        slotConsumed = ok;
      } else if (isPlatformStaff && course.type === "live") {
        await db.insert(slots).values({
          organisationId: orgId,
          courseId: course.id,
          totalSlots: 50,
          usedSlots: 1,
        });
        slotConsumed = true;
      }
    }

    const prior = await findAnyEnrollment(input.studentId, course);
    try {
      if (prior) {
        await db
          .update(studentCourses)
          .set({
            batchId: liveAccess ? input.batchId ?? null : null,
            organisationId: orgId,
            assignedBy: actor.userId,
            accessType: input.accessType,
            liveAccess,
            liveAccessFrom: liveAccess ? liveFrom : null,
            liveAccessUntil: liveAccess ? input.liveAccessUntil ?? null : null,
            recordedAccess,
            recordedAccessFrom: recordedAccess ? recordedFrom : null,
            recordedAccessUntil: recordedAccess ? input.recordedAccessUntil ?? null : null,
            slotConsumed,
            isFree: input.isFree,
            adminNotes: input.adminNotes ?? null,
            status: "active",
            isActive: true,
            revokedAt: null,
            revokeReason: null,
            pausedAt: null,
            pauseReason: null,
            enrolledAt: now,
            updatedAt: now,
          })
          .where(eq(studentCourses.id, prior.id));

        await logAction({
          userId: actor.userId,
          role: actor.role as "super_admin",
          action: "enrollment.reactivated",
          entity: "Enrollment",
          entityId: prior.id,
          metadata: {
            studentId: input.studentId,
            courseId: course.id,
            courseType: course.type,
            accessType: input.accessType,
          },
          ipAddress: actor.ipAddress,
        });

        const { checkAndAutoIssueForEnrollment } = await import("@/lib/services/certificate-service");
        void checkAndAutoIssueForEnrollment(prior.id);
        enrolled.push(course.title);
        continue;
      }

      const [row] = await db
        .insert(studentCourses)
        .values({
          studentId: input.studentId,
          liveCourseId: course.type === "live" ? course.id : null,
          recordCourseId: course.type === "record" ? course.id : null,
          batchId: liveAccess ? input.batchId ?? null : null,
          organisationId: orgId,
          assignedBy: actor.userId,
          enrollmentSource: actor.role === "super_admin" ? "super_admin" : "org_admin",
          accessType: input.accessType,
          liveAccess,
          liveAccessFrom: liveAccess ? liveFrom : null,
          liveAccessUntil: liveAccess ? input.liveAccessUntil ?? null : null,
          recordedAccess,
          recordedAccessFrom: recordedAccess ? recordedFrom : null,
          recordedAccessUntil: recordedAccess ? input.recordedAccessUntil ?? null : null,
          slotConsumed,
          isFree: input.isFree,
          adminNotes: input.adminNotes ?? null,
          status: "active",
          isActive: true,
        })
        .returning();

      await logAction({
        userId: actor.userId,
        role: actor.role as "super_admin",
        action: "enrollment.created",
        entity: "Enrollment",
        entityId: row.id,
        metadata: {
          studentId: input.studentId,
          courseId: course.id,
          courseType: course.type,
          accessType: input.accessType,
        },
        ipAddress: actor.ipAddress,
      });

      const { checkAndAutoIssueForEnrollment } = await import("@/lib/services/certificate-service");
      void checkAndAutoIssueForEnrollment(row.id);

      enrolled.push(course.title);
    } catch (err) {
      if (slotConsumed && orgId) await freeOneSlot(orgId, course);
      errors.push(`${course.title}: ${err instanceof Error ? err.message : "enrollment failed"}`);
    }
  }

  return { enrolled, skipped, errors };
}

export async function updateEnrollment(
  enrollmentId: string,
  input: UpdateEnrollmentInput,
  actor: Actor
): Promise<{ success: boolean; error?: string }> {
  const [existing] = await db
    .select()
    .from(studentCourses)
    .where(eq(studentCourses.id, enrollmentId))
    .limit(1);
  if (!existing) return { success: false, error: "Enrollment not found" };

  const courseId = existing.liveCourseId ?? existing.recordCourseId;
  if (!courseId) return { success: false, error: "Invalid enrollment" };
  const course = await resolveCourse(courseId);
  if (!course) return { success: false, error: "Course not found" };

  if (input.accessType) {
    const err = validateAccessTypeForCourse(input.accessType, course);
    if (err) return { success: false, error: err };
  }

  const accessType = input.accessType ?? existing.accessType;
  const flags = deriveAccessFlags(accessType, course);
  const liveAccess = input.liveAccess ?? flags.liveAccess;
  const recordedAccess = input.recordedAccess ?? flags.recordedAccess;

  const status = input.status ?? existing.status;
  const isActive = status === "active";

  if (status === "revoked" && existing.slotConsumed && existing.organisationId) {
    // CAS: free seat only if still marked slotConsumed
    const freed = await db
      .update(studentCourses)
      .set({ slotConsumed: false, updatedAt: new Date() })
      .where(
        and(eq(studentCourses.id, enrollmentId), eq(studentCourses.slotConsumed, true))
      )
      .returning({ id: studentCourses.id });
    if (freed.length > 0) {
      await freeOneSlot(existing.organisationId, course);
    }
  }

  await db
    .update(studentCourses)
    .set({
      ...(input.accessType !== undefined && { accessType: input.accessType }),
      liveAccess,
      ...(input.liveAccessFrom !== undefined && { liveAccessFrom: input.liveAccessFrom }),
      ...(input.liveAccessUntil !== undefined && { liveAccessUntil: input.liveAccessUntil }),
      recordedAccess,
      ...(input.recordedAccessFrom !== undefined && { recordedAccessFrom: input.recordedAccessFrom }),
      ...(input.recordedAccessUntil !== undefined && { recordedAccessUntil: input.recordedAccessUntil }),
      ...(input.batchId !== undefined && { batchId: input.batchId }),
      status,
      isActive,
      ...(status === "paused" && { pausedAt: new Date(), pauseReason: input.pauseReason ?? null }),
      ...(status === "revoked" && {
        revokedAt: new Date(),
        revokeReason: input.revokeReason ?? null,
        slotConsumed: false,
      }),
      ...(input.adminNotes !== undefined && { adminNotes: input.adminNotes }),
      updatedAt: new Date(),
    })
    .where(eq(studentCourses.id, enrollmentId));

  await logAction({
    userId: actor.userId,
    role: actor.role as "super_admin",
    action: status === "revoked" ? "enrollment.revoked" : "enrollment.access_changed",
    entity: "Enrollment",
    entityId: enrollmentId,
    metadata: { old: existing, new: input },
    ipAddress: actor.ipAddress,
  });

  return { success: true };
}

export async function getStudentEnrollmentsRich(
  studentId: string
): Promise<EnrollmentWithCourse[]> {
  const rows = await db
    .select({
      enrollment: studentCourses,
      liveTitle: liveCourses.title,
      liveSlug: liveCourses.slug,
      liveThumb: liveCourses.thumbnailUrl,
      liveHasLive: liveCourses.hasLive,
      liveHasRecorded: liveCourses.hasRecorded,
      liveTotalModules: liveCourses.totalModules,
      recordTitle: recordCourses.title,
      recordSlug: recordCourses.slug,
      recordThumb: recordCourses.thumbnailUrl,
      recordHasLive: recordCourses.hasLive,
      recordHasRecorded: recordCourses.hasRecorded,
      recordTotalModules: recordCourses.totalModules,
    })
    .from(studentCourses)
    .leftJoin(liveCourses, eq(studentCourses.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(studentCourses.recordCourseId, recordCourses.id))
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.isActive, true),
        or(eq(studentCourses.status, "active"), eq(studentCourses.status, "completed"))
      )
    )
    .orderBy(desc(studentCourses.enrolledAt));

  const result: EnrollmentWithCourse[] = [];

  for (const row of rows) {
    const e = row.enrollment;
    const isLive = !!e.liveCourseId;
    const courseId = (isLive ? e.liveCourseId : e.recordCourseId)!;

    let nextLiveClassAt: Date | null = null;
    if (e.liveAccess && e.batchId) {
      const [next] = await db
        .select({ scheduledAt: liveClasses.scheduledAt })
        .from(liveClasses)
        .where(
          and(
            eq(liveClasses.batchId, e.batchId),
            sql`${liveClasses.scheduledAt} > NOW()`,
            isNull(liveClasses.deletedAt)
          )
        )
        .orderBy(asc(liveClasses.scheduledAt))
        .limit(1);
      nextLiveClassAt = next?.scheduledAt ?? null;
    }

    let totalModules = isLive ? row.liveTotalModules ?? 0 : row.recordTotalModules ?? 0;
    if (!totalModules && e.recordCourseId) {
      const [count] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(courseRecordings)
        .where(
          and(eq(courseRecordings.recordCourseId, e.recordCourseId), eq(courseRecordings.isPublished, true))
        );
      totalModules = count?.c ?? 0;
    }

    result.push({
      id: e.id,
      studentId: e.studentId,
      courseId,
      courseType: isLive ? "live" : "record",
      courseTitle: (isLive ? row.liveTitle : row.recordTitle)!,
      courseSlug: isLive ? row.liveSlug : row.recordSlug,
      courseThumbnail: isLive ? row.liveThumb : row.recordThumb,
      accessType: e.accessType,
      liveAccess: e.liveAccess,
      recordedAccess: e.recordedAccess,
      batchId: e.batchId,
      organisationId: e.organisationId,
      status: e.status,
      completionPercentage: e.completionPercentage,
      liveClassesAttended: e.liveClassesAttended,
      recordedModulesWatched: e.recordedModulesWatched,
      totalModules,
      certificate: e.certificate,
      enrolledAt: e.enrolledAt,
      lastAccessedAt: e.lastAccessedAt,
      nextLiveClassAt,
    });
  }

  return result;
}

export async function updateModuleProgress(input: {
  enrollmentId: string;
  studentId: string;
  moduleIndex: number;
  moduleTitle: string;
  watchedSeconds: number;
  durationSeconds: number;
  isCompleted: boolean;
  notes?: string;
}): Promise<{ completionPercentage: number; certificateUnlocked: boolean }> {
  const [enrollment] = await db
    .select()
    .from(studentCourses)
    .where(
      and(eq(studentCourses.id, input.enrollmentId), eq(studentCourses.studentId, input.studentId))
    )
    .limit(1);
  if (!enrollment?.recordedAccess) {
    return { completionPercentage: 0, certificateUnlocked: false };
  }

  const now = new Date();
  await db
    .insert(recordedModuleProgress)
    .values({
      enrollmentId: input.enrollmentId,
      studentId: input.studentId,
      liveCourseId: enrollment.liveCourseId,
      recordCourseId: enrollment.recordCourseId,
      moduleIndex: input.moduleIndex,
      moduleTitle: input.moduleTitle,
      watchedSeconds: input.watchedSeconds,
      durationSeconds: input.durationSeconds,
      isCompleted: input.isCompleted,
      completedAt: input.isCompleted ? now : null,
      lastWatchedAt: now,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [recordedModuleProgress.enrollmentId, recordedModuleProgress.moduleIndex],
      set: {
        watchedSeconds: input.watchedSeconds,
        isCompleted: input.isCompleted,
        completedAt: input.isCompleted ? now : null,
        lastWatchedAt: now,
        notes: input.notes ?? null,
      },
    });

  const completed = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(recordedModuleProgress)
    .where(
      and(eq(recordedModuleProgress.enrollmentId, input.enrollmentId), eq(recordedModuleProgress.isCompleted, true))
    );
  const total = enrollment.recordCourseId
    ? (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(courseRecordings)
          .where(eq(courseRecordings.recordCourseId, enrollment.recordCourseId))
      )[0]?.c ?? 1
    : 1;

  const pct = Math.min(100, Math.round(((completed[0]?.c ?? 0) / Math.max(total, 1)) * 100));
  const certificateUnlocked = pct >= 100;

  await db
    .update(studentCourses)
    .set({
      recordedModulesWatched: completed[0]?.c ?? 0,
      completionPercentage: pct,
      lastAccessedAt: now,
      ...(certificateUnlocked && {
        completedAt: now,
        status: "completed" as const,
        // Keep isActive true so completed courses remain visible/accessible
        isActive: true,
      }),
      updatedAt: now,
    })
    .where(eq(studentCourses.id, input.enrollmentId));

  if (certificateUnlocked) {
    const { triggerAutoIssuance } = await import("@/lib/services/certificate-service");
    void triggerAutoIssuance(input.enrollmentId);
  }

  return { completionPercentage: pct, certificateUnlocked };
}

export async function listEnrollmentsForAdmin(filters: {
  studentId?: string;
  orgId?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  accessType?: EnrollmentAccessType;
  limit?: number;
}) {
  const conditions = [];
  if (filters.studentId) conditions.push(eq(studentCourses.studentId, filters.studentId));
  if (filters.orgId) conditions.push(eq(studentCourses.organisationId, filters.orgId));
  if (filters.status) conditions.push(eq(studentCourses.status, filters.status));
  if (filters.accessType) conditions.push(eq(studentCourses.accessType, filters.accessType));
  if (filters.courseId) {
    conditions.push(
      or(
        eq(studentCourses.liveCourseId, filters.courseId),
        eq(studentCourses.recordCourseId, filters.courseId)
      )!
    );
  }

  return db
    .select({
      enrollment: studentCourses,
      studentName: users.name,
      studentEmail: users.email,
      orgName: organisations.name,
      liveTitle: liveCourses.title,
      recordTitle: recordCourses.title,
    })
    .from(studentCourses)
    .innerJoin(users, eq(studentCourses.studentId, users.id))
    .leftJoin(organisations, eq(studentCourses.organisationId, organisations.id))
    .leftJoin(liveCourses, eq(studentCourses.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(studentCourses.recordCourseId, recordCourses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(studentCourses.enrolledAt))
    .limit(filters.limit ?? 100);
}

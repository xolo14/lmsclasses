import { and, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  batches,
  liveClasses,
  classRecordings,
  coupons,
  studentCourses,
  slots,
  payments,
  liveClassAttendance,
  issuedCertificates,
  certificateTemplates,
  auditLogs,
  apiKeys,
  partnerLeads,
  widgetLeads,
  jobApplications,
  courseRecordings,
  liveCourses,
  recordCourses,
} from "@/lib/db/schema";

const ORG_DELETE_REVOKE_REASON = "Organisation deleted";

/** Soft-delete org and all associated trashable / active records. */
export async function softDeleteOrganisationCascade(orgId: string, now = new Date()) {
  await db
    .update(organisations)
    .set({ isActive: false, deletedAt: now, updatedAt: now })
    .where(eq(organisations.id, orgId));

  await db
    .update(users)
    .set({ isActive: false, deletedAt: now, updatedAt: now })
    .where(and(eq(users.organisationId, orgId), isNull(users.deletedAt)));

  // Admin may be linked only via organisations.admin_id
  const [org] = await db
    .select({ adminId: organisations.adminId })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);
  if (org?.adminId) {
    await db
      .update(users)
      .set({ isActive: false, deletedAt: now, updatedAt: now })
      .where(and(eq(users.id, org.adminId), isNull(users.deletedAt)));
  }

  await db
    .update(coupons)
    .set({ isActive: false, deletedAt: now, updatedAt: now })
    .where(and(eq(coupons.organisationId, orgId), isNull(coupons.deletedAt)));

  const orgBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.organisationId, orgId), isNull(batches.deletedAt)));
  const batchIds = orgBatches.map((b) => b.id);

  if (batchIds.length > 0) {
    await db.update(batches).set({ deletedAt: now }).where(inArray(batches.id, batchIds));
    await db
      .update(liveClasses)
      .set({ deletedAt: now })
      .where(and(inArray(liveClasses.batchId, batchIds), isNull(liveClasses.deletedAt)));
    await db
      .update(classRecordings)
      .set({ deletedAt: now })
      .where(and(inArray(classRecordings.batchId, batchIds), isNull(classRecordings.deletedAt)));
  }

  const activeEnrollments = await db
    .select({
      id: studentCourses.id,
      slotConsumed: studentCourses.slotConsumed,
      organisationId: studentCourses.organisationId,
      liveCourseId: studentCourses.liveCourseId,
      recordCourseId: studentCourses.recordCourseId,
    })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.organisationId, orgId),
        eq(studentCourses.isActive, true),
        or(eq(studentCourses.status, "active"), eq(studentCourses.status, "paused"), eq(studentCourses.status, "completed"))
      )
    );

  for (const e of activeEnrollments) {
    if (e.slotConsumed && e.organisationId) {
      const courseId = e.liveCourseId ?? e.recordCourseId;
      if (courseId) {
        const live = !!e.liveCourseId;
        await db
          .update(slots)
          .set({ usedSlots: sql`GREATEST(COALESCE(${slots.usedSlots}, 0) - 1, 0)` })
          .where(
            and(
              eq(slots.organisationId, e.organisationId),
              live ? eq(slots.courseId, courseId) : eq(slots.recordCourseId, courseId),
              sql`COALESCE(${slots.usedSlots}, 0) > 0`
            )
          );
      }
    }
  }

  await db
    .update(studentCourses)
    .set({
      isActive: false,
      status: "revoked",
      revokedAt: now,
      revokeReason: ORG_DELETE_REVOKE_REASON,
      slotConsumed: false,
      updatedAt: now,
    })
    .where(
      and(
        eq(studentCourses.organisationId, orgId),
        eq(studentCourses.isActive, true)
      )
    );

  await db
    .update(certificateTemplates)
    .set({ isActive: false, updatedAt: now })
    .where(eq(certificateTemplates.orgId, orgId));
}

/** Restore org and associated soft-deleted related rows from THIS cascade only. */
export async function restoreOrganisationCascade(orgId: string) {
  const [orgRow] = await db
    .select({
      adminId: organisations.adminId,
      deletedAt: organisations.deletedAt,
    })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  const cascadeAt = orgRow?.deletedAt ?? new Date(0);

  await db
    .update(organisations)
    .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
    .where(eq(organisations.id, orgId));

  // Only users soft-deleted with/after this org delete
  await db
    .update(users)
    .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(users.organisationId, orgId),
        isNotNull(users.deletedAt),
        gte(users.deletedAt, cascadeAt)
      )
    );

  if (orgRow?.adminId) {
    await db
      .update(users)
      .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
      .where(
        and(
          eq(users.id, orgRow.adminId),
          isNotNull(users.deletedAt),
          gte(users.deletedAt, cascadeAt)
        )
      );
  }

  await db
    .update(coupons)
    .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(coupons.organisationId, orgId),
        isNotNull(coupons.deletedAt),
        gte(coupons.deletedAt, cascadeAt)
      )
    );

  const orgBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(
      and(
        eq(batches.organisationId, orgId),
        isNotNull(batches.deletedAt),
        gte(batches.deletedAt, cascadeAt)
      )
    );
  const batchIds = orgBatches.map((b) => b.id);

  if (batchIds.length > 0) {
    await db.update(batches).set({ deletedAt: null }).where(inArray(batches.id, batchIds));
    await db
      .update(liveClasses)
      .set({ deletedAt: null })
      .where(
        and(
          inArray(liveClasses.batchId, batchIds),
          isNotNull(liveClasses.deletedAt),
          gte(liveClasses.deletedAt, cascadeAt)
        )
      );
    await db
      .update(classRecordings)
      .set({ deletedAt: null })
      .where(
        and(
          inArray(classRecordings.batchId, batchIds),
          isNotNull(classRecordings.deletedAt),
          gte(classRecordings.deletedAt, cascadeAt)
        )
      );
  }

  // Restore only enrollments revoked by this org delete; preserve completed if they had progress/cert
  const toRestore = await db
    .select({
      id: studentCourses.id,
      completedAt: studentCourses.completedAt,
      certificate: studentCourses.certificate,
    })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.organisationId, orgId),
        eq(studentCourses.revokeReason, ORG_DELETE_REVOKE_REASON)
      )
    );

  for (const row of toRestore) {
    const wasCompleted = !!row.completedAt || row.certificate;
    await db
      .update(studentCourses)
      .set({
        isActive: true,
        status: wasCompleted ? "completed" : "active",
        revokedAt: null,
        revokeReason: null,
        updatedAt: new Date(),
      })
      .where(eq(studentCourses.id, row.id));
  }

  // Only re-activate templates deactivated during this cascade (updatedAt >= cascadeAt)
  await db
    .update(certificateTemplates)
    .set({ isActive: true, updatedAt: new Date() })
    .where(
      and(
        eq(certificateTemplates.orgId, orgId),
        eq(certificateTemplates.isActive, false),
        gte(certificateTemplates.updatedAt, cascadeAt)
      )
    );
}

/** Clear FKs and permanently delete users (students/managers/mentors/org admins). */
export async function hardDeleteUsers(userIds: string[]) {
  if (userIds.length === 0) return;

  await db.delete(issuedCertificates).where(inArray(issuedCertificates.studentId, userIds));

  const mentored = await db
    .select({ id: liveClasses.id })
    .from(liveClasses)
    .where(inArray(liveClasses.mentorId, userIds));
  const mentoredIds = mentored.map((r) => r.id);
  if (mentoredIds.length > 0) {
    await db
      .delete(liveClassAttendance)
      .where(inArray(liveClassAttendance.liveClassId, mentoredIds));
    await db.delete(liveClasses).where(inArray(liveClasses.id, mentoredIds));
  }

  // Clear org admin pointers before removing admins
  await db
    .update(organisations)
    .set({ adminId: null })
    .where(inArray(organisations.adminId, userIds));

  await db.update(payments).set({ adminId: null }).where(inArray(payments.adminId, userIds));
  await db
    .update(studentCourses)
    .set({ assignedBy: null })
    .where(inArray(studentCourses.assignedBy, userIds));
  await db.delete(studentCourses).where(inArray(studentCourses.studentId, userIds));
  await db.update(auditLogs).set({ userId: null }).where(inArray(auditLogs.userId, userIds));
  await db.update(apiKeys).set({ createdBy: null }).where(inArray(apiKeys.createdBy, userIds));
  await db
    .update(partnerLeads)
    .set({ studentId: null })
    .where(inArray(partnerLeads.studentId, userIds));
  await db
    .update(widgetLeads)
    .set({ studentId: null })
    .where(inArray(widgetLeads.studentId, userIds));
  await db.delete(jobApplications).where(inArray(jobApplications.studentId, userIds));

  const [superAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "super_admin"), isNull(users.deletedAt)))
    .limit(1);
  if (superAdmin && !userIds.includes(superAdmin.id)) {
    await db
      .update(courseRecordings)
      .set({ createdBy: superAdmin.id })
      .where(inArray(courseRecordings.createdBy, userIds));
  } else {
    await db.delete(courseRecordings).where(inArray(courseRecordings.createdBy, userIds));
  }

  await db
    .update(classRecordings)
    .set({ uploadedBy: null })
    .where(inArray(classRecordings.uploadedBy, userIds));
  await db.update(batches).set({ createdBy: null }).where(inArray(batches.createdBy, userIds));
  await db
    .update(liveCourses)
    .set({ createdBy: null })
    .where(inArray(liveCourses.createdBy, userIds));
  await db
    .update(recordCourses)
    .set({ createdBy: null })
    .where(inArray(recordCourses.createdBy, userIds));
  await db
    .update(liveClasses)
    .set({ createdBy: null })
    .where(inArray(liveClasses.createdBy, userIds));
  await db
    .update(issuedCertificates)
    .set({ revokedBy: null })
    .where(inArray(issuedCertificates.revokedBy, userIds));

  // Reassign template authorship — do not delete org/global templates owned by purged users
  if (superAdmin && !userIds.includes(superAdmin.id)) {
    await db
      .update(certificateTemplates)
      .set({ createdBy: superAdmin.id, updatedAt: new Date() })
      .where(inArray(certificateTemplates.createdBy, userIds));
  }

  await db.delete(users).where(inArray(users.id, userIds));
}

/** Permanently remove organisations and every row that references them. */
export async function hardDeleteOrganisations(orgIds: string[]) {
  if (orgIds.length === 0) return;

  await db
    .update(organisations)
    .set({ adminId: null })
    .where(inArray(organisations.id, orgIds));

  const orgUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.organisationId, orgIds));
  const userIds = orgUsers.map((u) => u.id);

  const orgBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(inArray(batches.organisationId, orgIds));
  const batchIds = orgBatches.map((b) => b.id);

  await db.delete(issuedCertificates).where(inArray(issuedCertificates.orgId, orgIds));
  if (userIds.length > 0) {
    await db.delete(issuedCertificates).where(inArray(issuedCertificates.studentId, userIds));
  }
  await db.delete(certificateTemplates).where(inArray(certificateTemplates.orgId, orgIds));

  if (batchIds.length > 0) {
    const classRows = await db
      .select({ id: liveClasses.id })
      .from(liveClasses)
      .where(inArray(liveClasses.batchId, batchIds));
    const classIds = classRows.map((r) => r.id);

    if (classIds.length > 0) {
      await db.delete(liveClassAttendance).where(inArray(liveClassAttendance.liveClassId, classIds));
    }
    await db.delete(classRecordings).where(inArray(classRecordings.batchId, batchIds));
    await db.delete(liveClasses).where(inArray(liveClasses.batchId, batchIds));
  }

  await db.delete(studentCourses).where(inArray(studentCourses.organisationId, orgIds));

  await db.delete(slots).where(inArray(slots.organisationId, orgIds));
  await db.delete(payments).where(inArray(payments.organisationId, orgIds));
  await db.delete(coupons).where(inArray(coupons.organisationId, orgIds));

  if (batchIds.length > 0) {
    await db
      .update(certificateTemplates)
      .set({ batchId: null, updatedAt: new Date() })
      .where(inArray(certificateTemplates.batchId, batchIds));
    await db.delete(batches).where(inArray(batches.id, batchIds));
  }

  if (userIds.length > 0) {
    await hardDeleteUsers(userIds);
  }

  await db.delete(organisations).where(inArray(organisations.id, orgIds));
}

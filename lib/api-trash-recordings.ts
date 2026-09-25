import { NextResponse } from "next/server";
import { eq, desc, and, isNull, isNotNull, gte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  liveCourses,
  recordCourses,
  batches,
  liveClasses,
  classRecordings,
  studentCourses,
  coupons,
} from "@/lib/db/schema";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { classRecordingSchema } from "@/lib/validations";
import { readApiJson } from "@/lib/api-url-transport";
import { clearAllTrashImmediate, TRASH_RETENTION_DAYS, type TrashEntityType } from "@/lib/trash";
import { hasRecordedAccess } from "@/lib/content-access";
import { mentorHasCourseAccess } from "@/lib/mentor-courses";

const TRASH_TABLES = {
  organisation: { table: organisations, id: organisations.id, label: organisations.name },
  live_course: { table: liveCourses, id: liveCourses.id, label: liveCourses.title },
  record_course: { table: recordCourses, id: recordCourses.id, label: recordCourses.title },
  batch: { table: batches, id: batches.id, label: batches.name },
  live_class: { table: liveClasses, id: liveClasses.id, label: liveClasses.title },
  class_recording: { table: classRecordings, id: classRecordings.id, label: classRecordings.topicName },
  coupon: { table: coupons, id: coupons.id, label: coupons.code },
} as const;

export async function GETTrash() {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const [orgs, liveCourseRows, recordCourseRows, batchRows, liveRows, recordingRows, students, managers, mentors, couponRows] =
    await Promise.all([
      db
        .select({ id: organisations.id, name: organisations.name, deletedAt: organisations.deletedAt })
        .from(organisations)
        .where(isNotNull(organisations.deletedAt))
        .orderBy(desc(organisations.deletedAt)),
      db
        .select({ id: liveCourses.id, name: liveCourses.title, deletedAt: liveCourses.deletedAt })
        .from(liveCourses)
        .where(isNotNull(liveCourses.deletedAt))
        .orderBy(desc(liveCourses.deletedAt)),
      db
        .select({ id: recordCourses.id, name: recordCourses.title, deletedAt: recordCourses.deletedAt })
        .from(recordCourses)
        .where(isNotNull(recordCourses.deletedAt))
        .orderBy(desc(recordCourses.deletedAt)),
      db
        .select({ id: batches.id, name: batches.name, deletedAt: batches.deletedAt })
        .from(batches)
        .where(isNotNull(batches.deletedAt))
        .orderBy(desc(batches.deletedAt)),
      db
        .select({ id: liveClasses.id, name: liveClasses.title, deletedAt: liveClasses.deletedAt })
        .from(liveClasses)
        .where(isNotNull(liveClasses.deletedAt))
        .orderBy(desc(liveClasses.deletedAt)),
      db
        .select({
          id: classRecordings.id,
          name: classRecordings.topicName,
          deletedAt: classRecordings.deletedAt,
        })
        .from(classRecordings)
        .where(isNotNull(classRecordings.deletedAt))
        .orderBy(desc(classRecordings.deletedAt)),
      db
        .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
        .from(users)
        .where(and(eq(users.role, "student"), isNotNull(users.deletedAt)))
        .orderBy(desc(users.deletedAt)),
      db
        .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
        .from(users)
        .where(and(eq(users.role, "manager"), isNotNull(users.deletedAt)))
        .orderBy(desc(users.deletedAt)),
      db
        .select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
        .from(users)
        .where(and(eq(users.role, "mentor"), isNotNull(users.deletedAt)))
        .orderBy(desc(users.deletedAt)),
      db
        .select({ id: coupons.id, name: coupons.code, deletedAt: coupons.deletedAt })
        .from(coupons)
        .where(isNotNull(coupons.deletedAt))
        .orderBy(desc(coupons.deletedAt)),
    ]);

  const mapItem = (entityType: TrashEntityType, item: { id: string; name: string | null; deletedAt: Date | null }) => ({
    id: item.id,
    entityType,
    name: item.name || "—",
    deletedAt: item.deletedAt,
    expiresAt: item.deletedAt
      ? new Date(item.deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      : null,
  });

  return NextResponse.json({
    retentionDays: TRASH_RETENTION_DAYS,
    items: [
      ...orgs.map((o) => mapItem("organisation", o)),
      ...liveCourseRows.map((c) => mapItem("live_course", c)),
      ...recordCourseRows.map((c) => mapItem("record_course", c)),
      ...batchRows.map((b) => mapItem("batch", b)),
      ...liveRows.map((l) => mapItem("live_class", l)),
      ...recordingRows.map((r) => mapItem("class_recording", r)),
      ...students.map((s) => mapItem("student", s)),
      ...managers.map((m) => mapItem("manager", m)),
      ...mentors.map((m) => mapItem("mentor", m)),
      ...couponRows.map((cp) => mapItem("coupon", cp)),
    ].sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()),
  });
}

export async function POSTTrashRestore(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const { entityType, id } = (await request.json()) as { entityType: TrashEntityType; id: string };

  if (entityType === "student") {
    await db.update(users).set({ deletedAt: null, isActive: true }).where(eq(users.id, id));
    await db.update(studentCourses).set({ isActive: true }).where(eq(studentCourses.studentId, id));
  } else if (entityType === "manager" || entityType === "mentor") {
    await db.update(users).set({ deletedAt: null, isActive: true }).where(eq(users.id, id));
  } else if (entityType === "organisation") {
    const { restoreOrganisationCascade } = await import("@/lib/organisation-cascade");
    await restoreOrganisationCascade(id);
  } else if (entityType in TRASH_TABLES) {
    const key = entityType as keyof typeof TRASH_TABLES;
    const { table, id: idCol } = TRASH_TABLES[key];
    await db.update(table).set({ deletedAt: null }).where(eq(idCol, id));
    if (entityType === "live_course") {
      await db.update(liveCourses).set({ isActive: true }).where(eq(liveCourses.id, id));
    }
    if (entityType === "record_course") {
      await db.update(recordCourses).set({ isActive: true }).where(eq(recordCourses.id, id));
    }
    if (entityType === "coupon") {
      await db.update(coupons).set({ isActive: true }).where(eq(coupons.id, id));
    }
  } else {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "RESTORED_FROM_TRASH",
    entity: entityType,
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

export async function DELETETrashClearAll(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    await clearAllTrashImmediate();
  } catch (err) {
    console.error("[trash] clearAllTrashImmediate failed:", err);
    const message = err instanceof Error ? err.message : "Failed to clear trash";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CLEARED_ALL_TRASH",
    entity: "Trash",
    entityId: session!.user.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

export async function GETOngoingCourses() {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const now = new Date();

  const ongoing = await db
    .select({
      id: liveCourses.id,
      title: liveCourses.title,
      description: liveCourses.description,
      batchCount: sql<number>`count(distinct ${batches.id})::int`,
    })
    .from(liveCourses)
    .innerJoin(
      batches,
      and(
        eq(batches.courseId, liveCourses.id),
        isNull(batches.deletedAt),
        or(isNull(batches.endDate), gte(batches.endDate, now))
      )
    )
    .where(and(eq(liveCourses.isActive, true), isNull(liveCourses.deletedAt)))
    .groupBy(liveCourses.id, liveCourses.title, liveCourses.description)
    .orderBy(liveCourses.title);

  return NextResponse.json(ongoing);
}

export async function GETClassRecordings(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor", "student", "org_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const courseId = searchParams.get("courseId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId required" }, { status: 400 });
  }

  const [batch] = await db
    .select({
      id: batches.id,
      courseId: batches.courseId,
      organisationId: batches.organisationId,
      deletedAt: batches.deletedAt,
    })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!batch || batch.deletedAt) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const role = session!.user.role;
  if (role === "student") {
    const [enrollment] = await db
      .select()
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, session!.user.id),
          eq(studentCourses.batchId, batchId)
        )
      )
      .limit(1);
    if (!enrollment || !hasRecordedAccess(enrollment)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "mentor") {
    const allowed = batch.courseId ? await mentorHasCourseAccess(session!.user.id, batch.courseId) : false;
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (role === "org_admin") {
    const orgId = await resolveOrganisationId(session!);
    if (!orgId || (batch.organisationId && batch.organisationId !== orgId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const conditions = [eq(classRecordings.batchId, batchId), isNull(classRecordings.deletedAt)];
  if (courseId) conditions.push(eq(classRecordings.courseId, courseId));

  const recordings = await db
    .select({
      id: classRecordings.id,
      weekName: classRecordings.weekName,
      topicName: classRecordings.topicName,
      videoUrl: classRecordings.videoUrl,
      courseId: classRecordings.courseId,
      batchId: classRecordings.batchId,
      createdAt: classRecordings.createdAt,
      uploaderName: users.name,
    })
    .from(classRecordings)
    .leftJoin(users, eq(classRecordings.uploadedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(classRecordings.createdAt));

  return NextResponse.json(recordings);
}

export async function POSTClassRecording(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  const body = await readApiJson(request);
  const parsed = classRecordingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recording data" },
      { status: 400 }
    );
  }

  if (session!.user.role === "mentor") {
    const allowed = await mentorHasCourseAccess(session!.user.id, parsed.data.courseId);
    if (!allowed) {
      return NextResponse.json({ error: "You can only upload recordings for your assigned course." }, { status: 403 });
    }
  }

  const [batch] = await db
    .select({ id: batches.id, courseId: batches.courseId, deletedAt: batches.deletedAt })
    .from(batches)
    .where(eq(batches.id, parsed.data.batchId))
    .limit(1);
  if (!batch || batch.deletedAt || batch.courseId !== parsed.data.courseId) {
    return NextResponse.json({ error: "Batch does not belong to this course." }, { status: 400 });
  }

  try {
    const [recording] = await db
      .insert(classRecordings)
      .values({
        ...parsed.data,
        uploadedBy: session!.user.id,
      })
      .returning();

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "CREATED_CLASS_RECORDING",
      entity: "ClassRecording",
      entityId: recording.id,
      metadata: { weekName: parsed.data.weekName, topicName: parsed.data.topicName },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(recording, { status: 201 });
  } catch (err) {
    console.error("[POSTClassRecording]", err);
    return NextResponse.json({ error: "Failed to save class recording." }, { status: 500 });
  }
}

export async function PATCHClassRecording(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager", "mentor"]);
  if (error) return error;

  const body = await readApiJson(request);
  const parsed = classRecordingSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: classRecordings.id, courseId: classRecordings.courseId, batchId: classRecordings.batchId })
    .from(classRecordings)
    .where(and(eq(classRecordings.id, id), isNull(classRecordings.deletedAt)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  if (session!.user.role === "mentor") {
    const allowed = await mentorHasCourseAccess(session!.user.id, existing.courseId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const nextCourseId = parsed.data.courseId ?? existing.courseId;
  const nextBatchId = parsed.data.batchId ?? existing.batchId;
  const [batch] = await db
    .select({ courseId: batches.courseId, deletedAt: batches.deletedAt })
    .from(batches)
    .where(eq(batches.id, nextBatchId))
    .limit(1);
  if (!batch || batch.deletedAt || batch.courseId !== nextCourseId) {
    return NextResponse.json({ error: "Batch does not belong to this course." }, { status: 400 });
  }

  const [recording] = await db
    .update(classRecordings)
    .set(parsed.data)
    .where(and(eq(classRecordings.id, id), isNull(classRecordings.deletedAt)))
    .returning();

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  try {
    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "UPDATED_CLASS_RECORDING",
      entity: "ClassRecording",
      entityId: id,
      ipAddress: getClientIp(request),
    });
  } catch (auditErr) {
    console.error("[PATCHClassRecording audit]", auditErr);
  }

  return NextResponse.json(recording);
}

/** Move a recording to trash. Mentors can upload but only super_admin/manager may delete. */
export async function DELETEClassRecording(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const [recording] = await db
    .update(classRecordings)
    .set({ deletedAt: new Date() })
    .where(and(eq(classRecordings.id, id), isNull(classRecordings.deletedAt)))
    .returning({ id: classRecordings.id });

  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_CLASS_RECORDING",
    entity: "ClassRecording",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

export async function GETStudentRecordings(studentId: string) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  if (session!.user.id !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await db
    .select()
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        isNotNull(studentCourses.liveCourseId)
      )
    );

  const accessible = enrollments.filter((e) => hasRecordedAccess(e));

  if (accessible.length === 0) {
    return NextResponse.json([]);
  }

  const accessConditions = accessible.map((enrollment) => {
    if (enrollment.batchId) {
      return and(
        eq(classRecordings.courseId, enrollment.liveCourseId!),
        eq(classRecordings.batchId, enrollment.batchId)
      );
    }
    // Unbatched enrollments do not see org-specific batches.
    return sql`false`;
  });

  const recordings = await db
    .select({
      id: classRecordings.id,
      weekName: classRecordings.weekName,
      topicName: classRecordings.topicName,
      videoUrl: classRecordings.videoUrl,
      courseTitle: liveCourses.title,
      batchName: batches.name,
      createdAt: classRecordings.createdAt,
    })
    .from(classRecordings)
    .innerJoin(liveCourses, eq(classRecordings.courseId, liveCourses.id))
    .innerJoin(batches, eq(classRecordings.batchId, batches.id))
    .where(and(isNull(classRecordings.deletedAt), or(...accessConditions)))
    .orderBy(desc(classRecordings.createdAt));

  return NextResponse.json(recordings);
}

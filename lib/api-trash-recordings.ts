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
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { classRecordingSchema } from "@/lib/validations";
import { purgeExpiredTrash, clearAllTrashImmediate, TRASH_RETENTION_DAYS, type TrashEntityType } from "@/lib/trash";

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

  await purgeExpiredTrash();

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
    if (entityType === "organisation") {
      await db.update(organisations).set({ isActive: true }).where(eq(organisations.id, id));
      const [org] = await db
        .select({ adminId: organisations.adminId })
        .from(organisations)
        .where(eq(organisations.id, id))
        .limit(1);
      if (org?.adminId) {
        await db
          .update(users)
          .set({ deletedAt: null, isActive: true })
          .where(eq(users.id, org.adminId));
      }
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

  await clearAllTrashImmediate();

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
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  const courseId = searchParams.get("courseId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId required" }, { status: 400 });
  }

  if (session!.user.role === "student") {
    const [enrollment] = await db
      .select()
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.studentId, session!.user.id),
          eq(studentCourses.batchId, batchId),
          eq(studentCourses.isActive, true)
        )
      )
      .limit(1);
    if (!enrollment) {
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
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = classRecordingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

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
}

export async function PATCHClassRecording(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = classRecordingSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [recording] = await db
    .update(classRecordings)
    .set(parsed.data)
    .where(eq(classRecordings.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_CLASS_RECORDING",
    entity: "ClassRecording",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(recording);
}

export async function DELETEClassRecording(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db
    .update(classRecordings)
    .set({ deletedAt: new Date() })
    .where(eq(classRecordings.id, id));

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
    .select({
      liveCourseId: studentCourses.liveCourseId,
      batchId: studentCourses.batchId,
    })
    .from(studentCourses)
    .where(
      and(
        eq(studentCourses.studentId, studentId),
        eq(studentCourses.isActive, true),
        isNotNull(studentCourses.liveCourseId)
      )
    );

  if (enrollments.length === 0) {
    return NextResponse.json([]);
  }

  const accessConditions = enrollments.map((enrollment) => {
    if (enrollment.batchId) {
      return and(
        eq(classRecordings.courseId, enrollment.liveCourseId!),
        eq(classRecordings.batchId, enrollment.batchId)
      );
    }
    // Enrolled in course but batch not set — show all recordings for that course
    return eq(classRecordings.courseId, enrollment.liveCourseId!);
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

import { NextResponse } from "next/server";
import { eq, desc, sql, and, or, gte, lte, isNull, inArray, isNotNull, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  liveCourses,
  recordCourses,
  batches,
  payments,
  slots,
  studentCourses,
  liveClasses,
  auditLogs,
  jobApplications,
  courseLeads,
} from "@/lib/db/schema";
import { requireAuth, resolveOrganisationId } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { organisationSchema, editOrganisationSchema, courseSchema, managerSchema, mentorSchema, batchSchema, liveClassSchema, studentSchema } from "@/lib/validations";
import {
  sendOrgAdminWelcomeEmail,
  sendStudentWelcomeEmail,
  sendMentorLiveClassEmail,
  sendManagerWelcomeEmail,
  sendMentorWelcomeEmail,
  trySendWelcomeEmail,
} from "@/lib/email";
import { generatePassword, generateLmsId } from "@/lib/razorpay";

/** Mark scheduled/live classes as completed once end time (start + duration) has passed. */
async function autoCompletePastLiveClasses(filters?: { courseId?: string; mentorId?: string }) {
  const conditions = [
    isNull(liveClasses.deletedAt),
    inArray(liveClasses.status, ["scheduled", "live"]),
    sql`(${liveClasses.scheduledAt} + (COALESCE(${liveClasses.duration}, 60) * INTERVAL '1 minute')) < NOW()`,
  ];
  if (filters?.courseId) conditions.push(eq(liveClasses.courseId, filters.courseId));
  if (filters?.mentorId) conditions.push(eq(liveClasses.mentorId, filters.mentorId));

  await db.update(liveClasses).set({ status: "completed" }).where(and(...conditions));
}

// ============ ORGANISATIONS ============
export async function GETOrganisations() {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      email: organisations.email,
      phone: organisations.phone,
      logoUrl: organisations.logoUrl,
      address: organisations.address,
      isActive: organisations.isActive,
      jobPortalAccess: organisations.jobPortalAccess,
      createdAt: organisations.createdAt,
      adminId: organisations.adminId,
      adminName: users.name,
      adminEmail: users.email,
    })
    .from(organisations)
    .leftJoin(users, eq(organisations.adminId, users.id))
    .where(isNull(organisations.deletedAt))
    .orderBy(desc(organisations.createdAt));

  const enriched = await Promise.all(
    orgs.map(async (org) => {
      const [studentCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.organisationId, org.id),
            eq(users.role, "student"),
            isNull(users.deletedAt)
          )
        );

      const [courseCount] = await db
        .select({ count: sql<number>`count(distinct ${slots.courseId})::int` })
        .from(slots)
        .where(eq(slots.organisationId, org.id));

      return {
        ...org,
        studentCount: studentCount?.count ?? 0,
        coursesBought: courseCount?.count ?? 0,
      };
    })
  );

  return NextResponse.json(enriched);
}

export async function POSTOrganisation(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = organisationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { orgName, adminName, email, phone, password, address, jobPortalAccess } = parsed.data;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [org] = await db
    .insert(organisations)
    .values({ name: orgName, email, phone, address, jobPortalAccess })
    .returning();

  const [admin] = await db
    .insert(users)
    .values({
      name: adminName,
      email,
      phone,
      password: hashedPassword,
      role: "org_admin",
      organisationId: org.id,
    })
    .returning();

  await db
    .update(organisations)
    .set({ adminId: admin.id })
    .where(eq(organisations.id, org.id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CREATED_ORGANISATION",
    entity: "Organisation",
    entityId: org.id,
    metadata: { orgName, adminEmail: email },
    ipAddress: getClientIp(request),
  });

  await trySendWelcomeEmail("org admin welcome", () =>
    sendOrgAdminWelcomeEmail({ email, adminName, orgName, password })
  );

  return NextResponse.json({ org, admin }, { status: 201 });
}

export async function PATCHOrganisation(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = editOrganisationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(organisations)
    .where(and(eq(organisations.id, id), isNull(organisations.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const { orgName, adminName, email, phone, password, address, isActive, jobPortalAccess } = parsed.data;

  let currentAdminEmail: string | null = null;
  if (existing.adminId) {
    const [admin] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, existing.adminId))
      .limit(1);
    currentAdminEmail = admin?.email ?? null;
  }
  if (email !== currentAdminEmail && email !== existing.email) {
    const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (emailTaken) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const [org] = await db
    .update(organisations)
    .set({
      name: orgName,
      email,
      phone: phone || null,
      address: address || null,
      ...(isActive !== undefined && { isActive }),
      ...(jobPortalAccess !== undefined && { jobPortalAccess }),
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, id))
    .returning();

  if (existing.adminId) {
    const adminUpdate: Record<string, unknown> = {
      name: adminName,
      email,
      phone: phone || null,
      updatedAt: new Date(),
    };
    if (password) {
      adminUpdate.password = await bcrypt.hash(password, 12);
    }
    await db.update(users).set(adminUpdate).where(eq(users.id, existing.adminId));
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_ORGANISATION",
    entity: "Organisation",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(org);
}

export async function DELETEOrganisation(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const [existing] = await db
    .select()
    .from(organisations)
    .where(and(eq(organisations.id, id), isNull(organisations.deletedAt)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const now = new Date();
  await db
    .update(organisations)
    .set({ isActive: false, deletedAt: now, updatedAt: now })
    .where(eq(organisations.id, id));

  if (existing.adminId) {
    await db
      .update(users)
      .set({ isActive: false, deletedAt: now, updatedAt: now })
      .where(eq(users.id, existing.adminId));
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_ORGANISATION",
    entity: "Organisation",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ COURSES ============
export async function GETLiveCourses() {
  const { error } = await requireAuth();
  if (error) return error;

  const [allCourses, enrollmentCounts] = await Promise.all([
    db
      .select()
      .from(liveCourses)
      .where(isNull(liveCourses.deletedAt))
      .orderBy(desc(liveCourses.createdAt)),
    db
      .select({
        liveCourseId: studentCourses.liveCourseId,
        count: sql<number>`count(*)::int`,
      })
      .from(studentCourses)
      .where(and(eq(studentCourses.isActive, true), isNotNull(studentCourses.liveCourseId)))
      .groupBy(studentCourses.liveCourseId),
  ]);

  const countByCourse = new Map(
    enrollmentCounts.map((row) => [row.liveCourseId!, row.count])
  );

  const enriched = allCourses.map((course) => ({
    ...course,
    enrolledCount: countByCourse.get(course.id) ?? 0,
  }));

  return NextResponse.json(enriched);
}

export async function GETRecordCourses() {
  const { error } = await requireAuth();
  if (error) return error;

  const [allCourses, enrollmentCounts] = await Promise.all([
    db
      .select()
      .from(recordCourses)
      .where(isNull(recordCourses.deletedAt))
      .orderBy(desc(recordCourses.createdAt)),
    db
      .select({
        recordCourseId: studentCourses.recordCourseId,
        count: sql<number>`count(*)::int`,
      })
      .from(studentCourses)
      .where(and(eq(studentCourses.isActive, true), isNotNull(studentCourses.recordCourseId)))
      .groupBy(studentCourses.recordCourseId),
  ]);

  const countByCourse = new Map(
    enrollmentCounts.map((row) => [row.recordCourseId!, row.count])
  );

  const enriched = allCourses.map((course) => ({
    ...course,
    enrolledCount: countByCourse.get(course.id) ?? 0,
  }));

  return NextResponse.json(enriched);
}

export async function POSTLiveCourse(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ensureUniqueLiveCourseSlug } = await import("@/lib/slug");
  const slug = await ensureUniqueLiveCourseSlug(parsed.data.title);

  const [course] = await db
    .insert(liveCourses)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price.toString(),
      demoUrl: parsed.data.demoUrl,
      duration: parsed.data.duration,
      slug,
      createdBy: session!.user.id,
    })
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CREATED_LIVE_COURSE",
    entity: "LiveCourse",
    entityId: course.id,
    metadata: { title: course.title },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(course, { status: 201 });
}

export async function POSTRecordCourse(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const { recordCourseSchema } = await import("@/lib/validations");
  const parsed = recordCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ensureUniqueRecordCourseSlug } = await import("@/lib/slug");
  const slug = await ensureUniqueRecordCourseSlug(parsed.data.title);

  const demoUrl = parsed.data.demoUrl || null;
  const thumbnailUrl =
    "thumbnailUrl" in parsed.data && parsed.data.thumbnailUrl
      ? parsed.data.thumbnailUrl
      : null;

  const [course] = await db
    .insert(recordCourses)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price.toString(),
      demoUrl,
      demoVideoUrl: demoUrl,
      thumbnailUrl,
      duration: parsed.data.duration,
      slug,
      createdBy: session!.user.id,
    })
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CREATED_RECORD_COURSE",
    entity: "RecordCourse",
    entityId: course.id,
    metadata: { title: course.title },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(course, { status: 201 });
}

export async function PATCHLiveCourse(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = courseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { price, courseType, ...rest } = parsed.data;
  const updateData = {
    ...rest,
    ...(price !== undefined && { price: price.toString() }),
    updatedAt: new Date(),
  };

  const [course] = await db
    .update(liveCourses)
    .set(updateData)
    .where(eq(liveCourses.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_LIVE_COURSE",
    entity: "LiveCourse",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(course);
}

export async function PATCHRecordCourse(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const { recordCourseSchema } = await import("@/lib/validations");
  const parsed = recordCourseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { price, courseType, demoUrl, thumbnailUrl, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = {
    ...rest,
    ...(price !== undefined && { price: price.toString() }),
    ...(demoUrl !== undefined && {
      demoUrl: demoUrl || null,
      demoVideoUrl: demoUrl || null,
    }),
    ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl || null }),
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ slug: recordCourses.slug, title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, id))
    .limit(1);

  if (existing && !existing.slug) {
    const { ensureUniqueRecordCourseSlug } = await import("@/lib/slug");
    updateData.slug = await ensureUniqueRecordCourseSlug(
      (rest.title as string | undefined) ?? existing.title,
      id
    );
  }

  const [course] = await db
    .update(recordCourses)
    .set(updateData)
    .where(eq(recordCourses.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_RECORD_COURSE",
    entity: "RecordCourse",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(course);
}

export async function DELETELiveCourse(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db
    .update(liveCourses)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(liveCourses.id, id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_LIVE_COURSE",
    entity: "LiveCourse",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

export async function DELETERecordCourse(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db
    .update(recordCourses)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(recordCourses.id, id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_RECORD_COURSE",
    entity: "RecordCourse",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ STUDENTS ============
export async function GETStudents(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("organisationId");
  const courseId = searchParams.get("courseId");
  const batchId = searchParams.get("batchId");
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "50";
  const limitNum = Math.min(parseInt(limit), 100);

  const conditions = [eq(users.role, "student"), isNull(users.deletedAt)];

  if (session!.user.role === "org_admin" && session!.user.organisationId) {
    conditions.push(eq(users.organisationId, session!.user.organisationId));
  } else if (orgId === "direct") {
    conditions.push(isNull(users.organisationId));
  } else if (orgId) {
    conditions.push(eq(users.organisationId, orgId));
  }
  if (courseId) {
    conditions.push(or(eq(studentCourses.liveCourseId, courseId), eq(studentCourses.recordCourseId, courseId))!);
    conditions.push(eq(studentCourses.isActive, true));
  }
  if (batchId) conditions.push(eq(studentCourses.batchId, batchId));

  if (cursor) {
    conditions.push(gt(users.id, cursor));
  }

  // PERF: Retrieve paginated matching student IDs in a lightweight query before joining details
  const queryBuilder = db
    .selectDistinct({ id: users.id })
    .from(users);

  if (courseId || batchId) {
    queryBuilder.leftJoin(
      studentCourses,
      and(eq(studentCourses.studentId, users.id), eq(studentCourses.isActive, true))
    );
  }

  const studentIdsQuery = await queryBuilder
    .where(and(...conditions))
    .orderBy(users.id)
    .limit(limitNum + 1);

  const hasNextPage = studentIdsQuery.length > limitNum;
  const pageStudentIds = hasNextPage ? studentIdsQuery.slice(0, limitNum).map(s => s.id) : studentIdsQuery.map(s => s.id);
  const nextCursor = hasNextPage ? pageStudentIds[pageStudentIds.length - 1] : null;

  if (pageStudentIds.length === 0) {
    return NextResponse.json({ data: [], nextCursor: null, hasNextPage: false });
  }

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      lmsId: users.lmsId,
      collegeName: users.collegeName,
      isActive: users.isActive,
      createdAt: users.createdAt,
      organisationId: users.organisationId,
      orgName: organisations.name,
      enrollmentSource: studentCourses.enrollmentSource,
      source: studentCourses.enrollmentSource,
      enrollmentId: studentCourses.id,
      courseId: sql<string | null>`coalesce(${studentCourses.liveCourseId}, ${studentCourses.recordCourseId})`,
      courseTitle: sql<string | null>`coalesce(${liveCourses.title}, ${recordCourses.title})`,
      batchId: studentCourses.batchId,
      batchName: batches.name,
    })
    .from(users)
    .leftJoin(
      studentCourses,
      and(eq(studentCourses.studentId, users.id), eq(studentCourses.isActive, true))
    )
    .leftJoin(organisations, eq(users.organisationId, organisations.id))
    .leftJoin(liveCourses, eq(studentCourses.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(studentCourses.recordCourseId, recordCourses.id))
    .leftJoin(batches, eq(studentCourses.batchId, batches.id))
    .where(inArray(users.id, pageStudentIds))
    .orderBy(users.id);

  // BUG FIX: Super admin — one row per student with course count (not per enrollment)
  if (session!.user.role === "super_admin" && !courseId && !batchId) {
    const byStudent = new Map<
      string,
      (typeof students)[number] & { courseCount: number; enrollmentSources: Set<string> }
    >();

    for (const row of students) {
      const existing = byStudent.get(row.id);
      if (!existing) {
        byStudent.set(row.id, {
          ...row,
          courseCount: row.courseId ? 1 : 0,
          enrollmentSources: new Set(row.enrollmentSource ? [row.enrollmentSource] : []),
        });
      } else {
        if (row.courseId) existing.courseCount += 1;
        if (row.enrollmentSource) existing.enrollmentSources.add(row.enrollmentSource);
      }
    }

    const finalData = Array.from(byStudent.values()).map((r) => {
      const source =
         r.enrollmentSources.has("public")
          ? "public"
          : r.enrollmentSources.has("super_admin") || !r.organisationId
            ? "super_admin"
            : "org_admin";
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        lmsId: r.lmsId,
        collegeName: r.collegeName,
        isActive: r.isActive,
        createdAt: r.createdAt,
        organisationId: r.organisationId,
        orgName: r.orgName,
        enrollmentSource: source,
        source,
        courseTitle:
          r.courseCount > 0
            ? `${r.courseCount} course${r.courseCount === 1 ? "" : "s"}`
            : "—",
        batchName: "—",
      };
    });

    return NextResponse.json({ data: finalData, nextCursor, hasNextPage });
  }

  return NextResponse.json({ data: students, nextCursor, hasNextPage });
}

export async function POSTStudent(request: Request) {
  try {
    const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
    if (error) return error;

    const body = await request.json();
    const parsed = studentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, phone, lmsId, password, collegeName, courseId, batchId } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();
    const organisationId =
      session!.user.role === "org_admin"
        ? (await resolveOrganisationId(session!))!
        : body.organisationId;

    if (!organisationId) {
      return NextResponse.json(
        { error: "Organisation required — your admin account is not linked to an organisation." },
        { status: 400 }
      );
    }

    const isOrgAdmin = session!.user.role === "org_admin";

    // Query both liveCourses and recordCourses to verify course exists and determine its type
    const [liveCourse] = await db.select().from(liveCourses).where(eq(liveCourses.id, courseId)).limit(1);
    const [recordCourse] = await db.select().from(recordCourses).where(eq(recordCourses.id, courseId)).limit(1);
    const course = liveCourse || recordCourse;
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const isLive = !!liveCourse;

    // BUG FIX: Org Admin must assign a batch for live courses — live content is batch-gated
    if (isOrgAdmin && isLive && !batchId) {
      return NextResponse.json(
        {
          error:
            "Batch is required. Please create a batch for this course before adding students.",
        },
        { status: 400 }
      );
    }

    if (batchId) {
      if (!isLive) {
        return NextResponse.json(
          { error: "Record courses do not support batches." },
          { status: 400 }
        );
      }
      const batchConditions = [
        eq(batches.id, batchId),
        eq(batches.courseId, courseId),
        isNull(batches.deletedAt),
      ];
      if (isOrgAdmin) {
        batchConditions.push(eq(batches.organisationId, organisationId));
      }
      const [batch] = await db
        .select({ id: batches.id, courseId: batches.courseId })
        .from(batches)
        .where(and(...batchConditions))
        .limit(1);
      // BUG FIX: batch must belong to the enrolled course
      if (!batch || batch.courseId !== courseId) {
        return NextResponse.json(
          { error: "Batch does not belong to this course" },
          { status: 400 }
        );
      }
    }

    let slotRecords: typeof slots.$inferSelect[] = [];
    const isPlatformStaff = session!.user.role === "super_admin" || session!.user.role === "manager";

    if (isLive) {
      slotRecords = await db
        .select()
        .from(slots)
        .where(and(eq(slots.organisationId, organisationId), eq(slots.courseId, courseId)));

      const totalSlots = slotRecords.reduce((sum, s) => sum + s.totalSlots, 0);
      const usedSlots = slotRecords.reduce((sum, s) => sum + (s.usedSlots ?? 0), 0);

      if (!isPlatformStaff && usedSlots >= totalSlots) {
        if (totalSlots === 0) {
          return NextResponse.json(
            { error: "No slots purchased for this course. Buy slots from the dashboard first." },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: "SLOT_EXCEEDED", totalSlots, usedSlots },
          { status: 403 }
        );
      }
    }

    const existing = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) {
      const role = existing[0].role;
      return NextResponse.json(
        {
          error: `Email already in use${role ? ` (registered as ${role.replace("_", " ")})` : ""}. Use a different email.`,
        },
        { status: 409 }
      );
    }

    const plainPassword = password || generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    const finalLmsId = lmsId || generateLmsId();

    if (finalLmsId) {
      const existingLmsId = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.lmsId, finalLmsId))
        .limit(1);
      if (existingLmsId.length) {
        return NextResponse.json(
          { error: "LMS ID already exists. Clear the LMS ID field to auto-generate a new one." },
          { status: 409 }
        );
      }
    }

    const enrollmentSource = "org_admin";

    // BUG FIX: student + enrollment + slot decrement in one transaction (org admin path)
    const student = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: "student",
          lmsId: finalLmsId,
          collegeName: collegeName || null,
          organisationId,
        })
        .returning();

      await tx.insert(studentCourses).values({
        studentId: created.id,
        liveCourseId: isLive ? courseId : null,
        recordCourseId: isLive ? null : courseId,
        batchId: isLive ? (batchId || null) : null,
        organisationId,
        enrollmentSource,
      });

      if (isLive) {
        if (!isPlatformStaff) {
          const slotToUpdate = slotRecords.find((s) => (s.usedSlots ?? 0) < s.totalSlots);
          if (!slotToUpdate) {
            throw new Error("SLOT_EXCEEDED");
          }
          await tx
            .update(slots)
            .set({ usedSlots: (slotToUpdate.usedSlots ?? 0) + 1 })
            .where(eq(slots.id, slotToUpdate.id));
        } else if (slotRecords.length > 0) {
          const slotToUpdate = slotRecords.find((s) => (s.usedSlots ?? 0) < s.totalSlots);
          if (slotToUpdate) {
            await tx
              .update(slots)
              .set({ usedSlots: (slotToUpdate.usedSlots ?? 0) + 1 })
              .where(eq(slots.id, slotToUpdate.id));
          }
        } else {
          await tx.insert(slots).values({
            organisationId,
            courseId,
            totalSlots: 50,
            usedSlots: 1,
          });
        }
      }

      return created;
    });

    const emailResult = await trySendWelcomeEmail("student welcome", () =>
      sendStudentWelcomeEmail({
        email,
        studentName: name,
        lmsId: finalLmsId,
        password: plainPassword,
        courseName: course?.title || "Course",
      })
    );

    if (emailResult.sent) {
      console.log("[POSTStudent] Welcome email sent to", email);
    } else {
      console.error("[POSTStudent] Welcome email failed:", emailResult.error);
    }

    try {
      await logAction({
        userId: session!.user.id,
        role: session!.user.role,
        action: "CREATED_STUDENT",
        entity: "Student",
        entityId: student.id,
        metadata: { name, email, courseId, batchId, emailSent: emailResult.sent },
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error("[POSTStudent] Audit log failed (student still created):", auditErr);
    }

    return NextResponse.json(
      {
        ...student,
        email,
        password: plainPassword,
        emailSent: emailResult.sent,
        emailWarning: emailResult.sent
          ? undefined
          : emailResult.error ??
            "Welcome email was not sent. Check SMTP settings at /api/health.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POSTStudent]", err);
    const msg = err instanceof Error ? err.message : "Failed to create student";
    if (msg === "SLOT_EXCEEDED") {
      return NextResponse.json({ error: "SLOT_EXCEEDED" }, { status: 403 });
    }
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json(
        { error: "Email or LMS ID already exists. Use a different email or clear LMS ID." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCHStudent(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const body = await request.json();

  if (body.restore === true) {
    const [student] = await db
      .update(users)
      .set({ deletedAt: null, isActive: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await db
      .update(studentCourses)
      .set({ isActive: true })
      .where(eq(studentCourses.studentId, id));

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "RESTORED_STUDENT",
      entity: "Student",
      entityId: id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(student);
  }

  const { name, phone, email, collegeName, isActive } = body;

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (collegeName !== undefined) updates.collegeName = collegeName;
  if (isActive !== undefined) updates.isActive = isActive;

  const [student] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, id), eq(users.role, "student")))
    .returning();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_STUDENT",
    entity: "Student",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(student);
}

export async function DELETEStudent(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  if (session!.user.role === "org_admin") {
    // BUG FIX: soft-delete enrollment + free slot atomically (no hard deletes)
    await db.transaction(async (tx) => {
      const activeEnrollments = await tx
        .select({
          id: studentCourses.id,
          liveCourseId: studentCourses.liveCourseId,
          recordCourseId: studentCourses.recordCourseId,
          organisationId: studentCourses.organisationId,
        })
        .from(studentCourses)
        .where(and(eq(studentCourses.studentId, id), eq(studentCourses.isActive, true)));

      for (const enrollment of activeEnrollments) {
        if (enrollment.organisationId && enrollment.liveCourseId) {
          const orgSlots = await tx
            .select()
            .from(slots)
            .where(
              and(
                eq(slots.organisationId, enrollment.organisationId),
                eq(slots.courseId, enrollment.liveCourseId)
              )
            );
          const slotToDecrement = orgSlots.find((s) => (s.usedSlots ?? 0) > 0);
          if (slotToDecrement) {
            await tx
              .update(slots)
              .set({ usedSlots: (slotToDecrement.usedSlots ?? 0) - 1 })
              .where(eq(slots.id, slotToDecrement.id));
          }
        }
      }

      await tx
        .update(studentCourses)
        .set({ isActive: false })
        .where(eq(studentCourses.studentId, id));

      await tx
        .update(users)
        .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, id));
    });
  } else {
    await db
      .update(studentCourses)
      .set({ isActive: false })
      .where(eq(studentCourses.studentId, id));

    await db
      .update(users)
      .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_STUDENT",
    entity: "Student",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ MANAGERS & MENTORS ============
export async function GETUsersByRole(role: "manager" | "mentor") {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.role, role), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt));

  return NextResponse.json(result);
}

export async function POSTUserByRole(request: Request, role: "manager" | "mentor") {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const schema = role === "manager" ? managerSchema : mentorSchema;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, phone, password } = parsed.data;
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ name, email, phone, password: hashedPassword, role })
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: `CREATED_${role.toUpperCase()}`,
    entity: role === "manager" ? "Manager" : "Mentor",
    entityId: user.id,
    ipAddress: getClientIp(request),
  });

  const sendWelcome =
    role === "manager"
      ? () => sendManagerWelcomeEmail({ email, name, password })
      : () => sendMentorWelcomeEmail({ email, name, password });

  await trySendWelcomeEmail(`${role} welcome`, sendWelcome);

  return NextResponse.json(user, { status: 201 });
}

export async function PATCHUser(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const { name, phone, isActive, email, password } = body;

  if (email) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }
  }

  const updateData: {
    name?: string;
    phone?: string | null;
    isActive?: boolean;
    email?: string;
    password?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (email !== undefined) updateData.email = email;
  if (password) {
    updateData.password = await bcrypt.hash(password, 12);
  }

  const [user] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_USER",
    entity: "User",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(user);
}

export async function DELETEUser(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db
    .update(users)
    .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_USER",
    entity: "User",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ BATCHES ============
export async function GETBatches(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const organisationIdParam = searchParams.get("organisationId");

  const conditions = [isNull(batches.deletedAt)];

  if (session!.user.role === "org_admin") {
    const orgId = await resolveOrganisationId(session!);
    if (!orgId) {
      return NextResponse.json(
        { error: "Your account is not linked to an organisation." },
        { status: 403 }
      );
    }
    conditions.push(eq(batches.organisationId, orgId));
  } else if (organisationIdParam) {
    conditions.push(eq(batches.organisationId, organisationIdParam));
  }

  if (courseId) conditions.push(eq(batches.courseId, courseId));

  const result = await db
    .select({
      id: batches.id,
      name: batches.name,
      courseId: batches.courseId,
      courseTitle: liveCourses.title,
      organisationId: batches.organisationId,
      orgName: organisations.name,
      startDate: batches.startDate,
      endDate: batches.endDate,
      maxSlots: batches.maxSlots,
      createdAt: batches.createdAt,
    })
    .from(batches)
    .leftJoin(liveCourses, eq(batches.courseId, liveCourses.id))
    .leftJoin(organisations, eq(batches.organisationId, organisations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(batches.createdAt));

  const enriched = await Promise.all(
    result.map(async (batch) => {
      const [enrolled] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(studentCourses)
        .where(and(eq(studentCourses.batchId, batch.id), eq(studentCourses.isActive, true)));
      return { ...batch, enrolledCount: enrolled?.count ?? 0 };
    })
  );

  return NextResponse.json(enriched);
}

export async function POSTBatch(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const organisationId =
    session!.user.role === "org_admin"
      ? await resolveOrganisationId(session!)
      : parsed.data.organisationId;

  if (session!.user.role === "org_admin" && !organisationId) {
    return NextResponse.json(
      { error: "Your account is not linked to an organisation." },
      { status: 403 }
    );
  }

  const [batch] = await db
    .insert(batches)
    .values({
      name: parsed.data.name,
      courseId: parsed.data.courseId,
      organisationId: organisationId ?? null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      maxSlots: parsed.data.maxSlots,
      createdBy: session!.user.id,
    })
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CREATED_BATCH",
    entity: "Batch",
    entityId: batch.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(batch, { status: 201 });
}

export async function PATCHBatch(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const body = await request.json();
  const parsed = batchSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { startDate, endDate, organisationId, courseId, ...batchRest } = parsed.data;
  const updateData: Record<string, unknown> = { ...batchRest };
  if (startDate !== undefined) {
    updateData.startDate = startDate ? new Date(startDate) : null;
  }
  if (endDate !== undefined) {
    updateData.endDate = endDate ? new Date(endDate) : null;
  }

  const [batch] = await db
    .update(batches)
    .set(updateData as typeof batches.$inferInsert)
    .where(eq(batches.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_BATCH",
    entity: "Batch",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(batch);
}

export async function DELETEBatch(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db.update(batches).set({ deletedAt: new Date() }).where(eq(batches.id, id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_BATCH",
    entity: "Batch",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ LIVE CLASSES ============
export async function GETLiveClasses(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "active";

  const mentorId = session!.user.role === "mentor" ? session!.user.id : undefined;
  await autoCompletePastLiveClasses(mentorId ? { mentorId } : undefined);

  const conditions = [isNull(liveClasses.deletedAt)];

  if (tab === "completed") {
    // BUG FIX: mentors must still see cancelled classes for their records
    conditions.push(inArray(liveClasses.status, ["completed", "cancelled"]));
  } else {
    conditions.push(inArray(liveClasses.status, ["scheduled", "live"]));
    conditions.push(
      sql`(${liveClasses.scheduledAt} + (COALESCE(${liveClasses.duration}, 60) * INTERVAL '1 minute')) >= NOW()`
    );
  }

  if (mentorId) {
    conditions.push(eq(liveClasses.mentorId, mentorId));
  }

  const result = await db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      courseId: liveClasses.courseId,
      courseTitle: liveCourses.title,
      batchId: liveClasses.batchId,
      batchName: batches.name,
      mentorId: liveClasses.mentorId,
      mentorName: users.name,
      meetingLink: liveClasses.meetingLink,
      scheduledAt: liveClasses.scheduledAt,
      duration: liveClasses.duration,
      recordingUrl: liveClasses.recordingUrl,
      status: liveClasses.status,
      createdAt: liveClasses.createdAt,
    })
    .from(liveClasses)
    .leftJoin(liveCourses, eq(liveClasses.courseId, liveCourses.id))
    .leftJoin(batches, eq(liveClasses.batchId, batches.id))
    .leftJoin(users, eq(liveClasses.mentorId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(liveClasses.scheduledAt));

  return NextResponse.json(result);
}

export async function POSTLiveClass(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = liveClassSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [liveClass] = await db
    .insert(liveClasses)
    .values({
      title: parsed.data.title,
      courseId: parsed.data.courseId,
      batchId: parsed.data.batchId || null,
      mentorId: parsed.data.mentorId,
      meetingLink: parsed.data.meetingLink || null,
      scheduledAt: new Date(parsed.data.scheduledAt),
      duration: parsed.data.duration,
      createdBy: session!.user.id,
    })
    .returning();

  // PERF: Fetch mentor, course, and batch metadata in parallel with explicit column selections
  const [[mentor], [course], [batch]] = await Promise.all([
    db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, parsed.data.mentorId)).limit(1),
    db.select({ title: liveCourses.title }).from(liveCourses).where(eq(liveCourses.id, parsed.data.courseId)).limit(1),
    parsed.data.batchId
      ? db.select({ name: batches.name }).from(batches).where(eq(batches.id, parsed.data.batchId)).limit(1)
      : Promise.resolve([null] as any[]),
  ]);

  if (mentor && course) {
    await sendMentorLiveClassEmail({
      email: mentor.email,
      mentorName: mentor.name,
      title: parsed.data.title,
      courseName: course.title,
      batchName: batch?.name,
      scheduledAt: parsed.data.scheduledAt,
      meetingLink: parsed.data.meetingLink,
    });
  }

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "CREATED_LIVE_CLASS",
    entity: "LiveClass",
    entityId: liveClass.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(liveClass, { status: 201 });
}

export async function PATCHLiveClass(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = liveClassSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.scheduledAt) {
    updateData.scheduledAt = new Date(parsed.data.scheduledAt);
  }

  const [liveClass] = await db
    .update(liveClasses)
    .set(updateData)
    .where(eq(liveClasses.id, id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_LIVE_CLASS",
    entity: "LiveClass",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(liveClass);
}

export async function DELETELiveClass(request: Request, id: string) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  await db.update(liveClasses).set({ deletedAt: new Date() }).where(eq(liveClasses.id, id));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "DELETED_LIVE_CLASS",
    entity: "LiveClass",
    entityId: id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

// ============ PAYMENTS ============
export async function GETPayments(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager", "org_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "50";
  const limitNum = Math.min(parseInt(limit), 100);
  const type = searchParams.get("type");

  const conditions = [];
  const isOrgAdmin = session!.user.role === "org_admin" && session!.user.organisationId;
  if (isOrgAdmin) {
    conditions.push(eq(payments.organisationId, session!.user.organisationId!));
    conditions.push(isNotNull(payments.liveCourseId));
  } else if (type === "live") {
    conditions.push(isNotNull(payments.liveCourseId));
  } else if (type === "record") {
    conditions.push(isNotNull(payments.recordCourseId));
  }

  if (cursor) {
    conditions.push(sql`${payments.createdAt} < ${new Date(cursor)}`);
  }

  const result = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      slotsCount: payments.slotsCount,
      status: payments.status,
      razorpayOrderId: payments.razorpayOrderId,
      razorpayPaymentId: payments.razorpayPaymentId,
      invoiceUrl: payments.invoiceUrl,
      createdAt: payments.createdAt,
      courseTitle: sql<string | null>`coalesce(${liveCourses.title}, ${recordCourses.title})`,
      orgName: organisations.name,
      adminName: users.name,
    })
    .from(payments)
    .leftJoin(liveCourses, eq(payments.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(payments.recordCourseId, recordCourses.id))
    .leftJoin(organisations, eq(payments.organisationId, organisations.id))
    .leftJoin(users, eq(payments.adminId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(payments.createdAt))
    .limit(limitNum + 1);

  const hasNextPage = result.length > limitNum;
  const data = hasNextPage ? result.slice(0, limitNum) : result;
  const nextCursor = hasNextPage && data.length ? data[data.length - 1].createdAt?.toISOString() : null;

  return NextResponse.json({ data, nextCursor, hasNextPage });
}

// ============ COURSE LEADS ============
export async function GETCourseLeads(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "50";
  const limitNum = Math.min(parseInt(limit), 100);

  const conditions = [];
  if (cursor) {
    conditions.push(sql`${courseLeads.createdAt} < ${new Date(cursor)}`);
  }

  const result = await db
    .select({
      id: courseLeads.id,
      name: courseLeads.name,
      phone: courseLeads.phone,
      courseSlug: courseLeads.courseSlug,
      courseTitle: courseLeads.courseTitle,
      createdAt: courseLeads.createdAt,
    })
    .from(courseLeads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(courseLeads.createdAt))
    .limit(limitNum + 1);

  const hasNextPage = result.length > limitNum;
  const data = hasNextPage ? result.slice(0, limitNum) : result;
  const nextCursor = hasNextPage && data.length ? data[data.length - 1].createdAt?.toISOString() : null;

  return NextResponse.json({ data, nextCursor, hasNextPage });
}

// ============ AUDIT LOGS ============
export async function GETAuditLogs(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "50";
  const limitNum = Math.min(parseInt(limit), 100);

  const conditions = [];
  if (role) conditions.push(eq(auditLogs.role, role as typeof auditLogs.role.enumValues[number]));

  if (cursor) {
    conditions.push(sql`${auditLogs.createdAt} < ${new Date(cursor)}`);
  }

  const logs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      role: auditLogs.role,
      createdAt: auditLogs.createdAt,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limitNum + 1);

  const hasNextPage = logs.length > limitNum;
  const data = hasNextPage ? logs.slice(0, limitNum) : logs;
  const nextCursor = hasNextPage && data.length ? data[data.length - 1].createdAt?.toISOString() : null;

  return NextResponse.json({ data, nextCursor, hasNextPage });
}

// ============ DASHBOARD STATS ============
export async function GETDashboardStats(scope?: "org" | "global", organisationId?: string) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const orgFilter =
    scope === "org" && organisationId
      ? eq(users.organisationId, organisationId)
      : undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const activeCoursesQuery =
    scope === "org" && organisationId
      ? db
          .select({
            count: sql<number>`count(distinct ${slots.courseId})::int`,
          })
          .from(slots)
          .innerJoin(liveCourses, eq(slots.courseId, liveCourses.id))
          .where(
            and(
              eq(slots.organisationId, organisationId),
              eq(liveCourses.isActive, true),
              isNull(liveCourses.deletedAt)
            )
          )
      : db
          .select({
            count: sql<number>`(SELECT COUNT(*)::int FROM ${liveCourses} WHERE is_active = true AND deleted_at IS NULL) + (SELECT COUNT(*)::int FROM ${recordCourses} WHERE is_active = true AND deleted_at IS NULL)`,
          })
          .from(users)
          .limit(1);

  // PERF: Fetch independent KPI metrics in parallel to reduce Time-To-First-Byte
  const [
    [totalOrgs],
    [totalStudents],
    [totalRevenue],
    [activeCourses],
    [liveClassesToday],
    orgSlots,
    [paymentsMade]
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(organisations),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(
        orgFilter
          ? and(eq(users.role, "student"), orgFilter)
          : eq(users.role, "student")
      ),
    db
      .select({ sum: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(
        orgFilter
          ? and(
              eq(payments.status, "success"),
              eq(payments.organisationId, organisationId!),
              isNotNull(payments.liveCourseId)
            )
          : eq(payments.status, "success")
      ),
    activeCoursesQuery,
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(liveClasses)
      .where(and(gte(liveClasses.scheduledAt, today), lte(liveClasses.scheduledAt, tomorrow))),
    scope === "org" && organisationId
      ? db
          .select({
            totalSlots: slots.totalSlots,
            usedSlots: slots.usedSlots,
          })
          .from(slots)
          .where(eq(slots.organisationId, organisationId))
      : Promise.resolve([] as { totalSlots: number; usedSlots: number | null }[]),
    scope === "org" && organisationId
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(payments)
          .where(
            and(
              eq(payments.organisationId, organisationId),
              eq(payments.status, "success"),
              isNotNull(payments.liveCourseId)
            )
          )
      : Promise.resolve([{ count: 0 }])
  ]);

  let slotsRemaining = 0;
  if (scope === "org" && organisationId && Array.isArray(orgSlots)) {
    slotsRemaining = orgSlots.reduce(
      (sum, s) => sum + (s.totalSlots - (s.usedSlots ?? 0)),
      0
    );
  }

  return NextResponse.json({
    totalOrgs: totalOrgs?.count ?? 0,
    totalStudents: totalStudents?.count ?? 0,
    totalRevenue: totalRevenue?.sum ?? "0",
    activeCourses: activeCourses?.count ?? 0,
    liveClassesToday: liveClassesToday?.count ?? 0,
    slotsRemaining,
    paymentsMade: paymentsMade?.count ?? 0,
  });
}

// ============ SLOTS ============
export async function GETSlots(courseId: string, organisationId: string) {
  const { error } = await requireAuth(["org_admin"]);
  if (error) return error;

  const slotRecords = await db
    .select()
    .from(slots)
    .where(and(eq(slots.organisationId, organisationId), eq(slots.courseId, courseId)));

  const totalSlots = slotRecords.reduce((sum, s) => sum + s.totalSlots, 0);
  const usedSlots = slotRecords.reduce((sum, s) => sum + (s.usedSlots ?? 0), 0);

  return NextResponse.json({ totalSlots, usedSlots, remaining: totalSlots - usedSlots });
}

// ============ HISTORY ============
export async function GETHistory(organisationId: string) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  if (session!.user.organisationId !== organisationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const paymentHistory = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      slotsCount: payments.slotsCount,
      status: payments.status,
      createdAt: payments.createdAt,
      courseTitle: liveCourses.title,
    })
    .from(payments)
    .innerJoin(liveCourses, eq(payments.liveCourseId, liveCourses.id))
    .where(
      and(eq(payments.organisationId, organisationId), isNotNull(payments.liveCourseId))
    )
    .orderBy(desc(payments.createdAt));

  const studentActivity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, session!.user.id),
        sql`${auditLogs.action} LIKE '%STUDENT%'`
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return NextResponse.json({ payments: paymentHistory, studentActivity });
}

// ============ STUDENT COURSES ============
export async function GETStudentCourses(studentId: string) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  if (session!.user.id !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrolled = await db
    .select({
      courseId: sql<string>`coalesce(${studentCourses.liveCourseId}, ${studentCourses.recordCourseId})`,
      title: sql<string>`coalesce(${liveCourses.title}, ${recordCourses.title})`,
      description: sql<string | null>`coalesce(${liveCourses.description}, ${recordCourses.description})`,
      price: sql<string>`coalesce(${liveCourses.price}, ${recordCourses.price})`,
      demoUrl: sql<string | null>`coalesce(${liveCourses.demoUrl}, ${recordCourses.demoUrl})`,
      duration: sql<string | null>`coalesce(${liveCourses.duration}, ${recordCourses.duration})`,
      batchName: batches.name,
      enrolledAt: studentCourses.enrolledAt,
      courseType: sql<string>`case when ${studentCourses.liveCourseId} is not null then 'live' else 'record' end`,
    })
    .from(studentCourses)
    .leftJoin(liveCourses, eq(studentCourses.liveCourseId, liveCourses.id))
    .leftJoin(recordCourses, eq(studentCourses.recordCourseId, recordCourses.id))
    .leftJoin(batches, eq(studentCourses.batchId, batches.id))
    .where(
      and(eq(studentCourses.studentId, studentId), eq(studentCourses.isActive, true))
    );

  return NextResponse.json(enrolled);
}

export async function GETStudentLiveClasses(
  courseId: string,
  studentId: string,
  tab: "active" | "completed" | "recordings" = "active"
) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  if (session!.user.id !== studentId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await autoCompletePastLiveClasses({ courseId });

  const conditions = [
    eq(liveClasses.courseId, courseId),
    isNull(liveClasses.deletedAt),
  ];

  if (tab === "completed" || tab === "recordings") {
    conditions.push(eq(liveClasses.status, "completed"));
    if (tab === "recordings") {
      conditions.push(isNotNull(liveClasses.recordingUrl));
    }
  } else {
    conditions.push(inArray(liveClasses.status, ["scheduled", "live"]));
    conditions.push(
      sql`(${liveClasses.scheduledAt} + (COALESCE(${liveClasses.duration}, 60) * INTERVAL '1 minute')) >= NOW()`
    );
  }

  const classes = await db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      mentorName: users.name,
      meetingLink: liveClasses.meetingLink,
      scheduledAt: liveClasses.scheduledAt,
      duration: liveClasses.duration,
      recordingUrl: liveClasses.recordingUrl,
      status: liveClasses.status,
    })
    .from(liveClasses)
    .leftJoin(users, eq(liveClasses.mentorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(liveClasses.scheduledAt));

  return NextResponse.json(classes);
}

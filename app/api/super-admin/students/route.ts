import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { batches, courses, studentCourses, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { DirectStudentSchema } from "@/lib/validations/super-admin-student";
import { logAction, getClientIp } from "@/lib/audit";
import { sendWelcomeEmail, trySendWelcomeEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

const nanoid6 = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

function generateDirectLmsId(): string {
  return `LMS${nanoid6()}`;
}

async function createUniqueLmsId(): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const lmsId = generateDirectLmsId();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.lmsId, lmsId))
      .limit(1);
    if (!existing) return lmsId;
  }
  throw new Error("Failed to generate unique LMS ID");
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = DirectStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, phone, password, collegeName, courseId, batchId } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    let courseTitle: string | undefined;
    if (courseId) {
      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.isActive, true), isNull(courses.deletedAt)))
        .limit(1);
      if (!course) {
        return NextResponse.json({ error: "Course not found or inactive" }, { status: 404 });
      }
      courseTitle = course.title;

      if (batchId) {
        const [batch] = await db
          .select({ id: batches.id })
          .from(batches)
          .where(
            and(eq(batches.id, batchId), eq(batches.courseId, courseId), isNull(batches.deletedAt))
          )
          .limit(1);
        if (!batch) {
          return NextResponse.json({ error: "Invalid batch for selected course" }, { status: 400 });
        }
      }
    }

    const lmsId = await createUniqueLmsId();
    const hashedPassword = await bcrypt.hash(password, 12);

    const [student] = await db
      .insert(users)
      .values({
        name,
        email,
        phone,
        password: hashedPassword,
        role: "student",
        lmsId,
        collegeName,
        organisationId: null,
      })
      .returning();

    if (courseId) {
      await db.insert(studentCourses).values({
        studentId: student.id,
        courseId,
        batchId: batchId ?? null,
        organisationId: null,
        enrollmentSource: "super_admin",
      });
    }

    await trySendWelcomeEmail("direct student welcome", () =>
      sendWelcomeEmail({
        to: email,
        name,
        lmsId,
        password,
        courseTitle,
        loginUrl: `${getAppUrl()}/login`,
      })
    );

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "DIRECT_STUDENT_CREATED",
      entity: "Student",
      entityId: student.id,
      metadata: { courseId, directEnrollment: true },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        student: { id: student.id, name: student.name, email: student.email, lmsId },
        enrolled: !!courseId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[super-admin/students]", err);
    const msg = err instanceof Error ? err.message : "Failed to create student";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { courses, payments, studentCourses, users } from "@/lib/db/schema";
import { PublicEnrollmentSchema } from "@/lib/validations/public-enrollment";
import { verifySignature } from "@/lib/razorpay";
import { logAction, getClientIp } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { buildSessionSetCookieHeader } from "@/lib/session-token";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

function generatePublicLmsId(): string {
  return `LMS${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

async function insertUniqueStudent(
  data: {
    name: string;
    email: string;
    phone: string;
    hashedPassword: string;
    collegeName: string;
    lmsId: string;
  },
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [student] = await tx
        .insert(users)
        .values({
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.hashedPassword,
          role: "student",
          lmsId: data.lmsId,
          collegeName: data.collegeName,
          organisationId: null,
        })
        .returning();
      return student;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate/i.test(msg) && /lms_id/i.test(msg)) {
        data.lmsId = generatePublicLmsId();
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to generate unique LMS ID");
}

export async function POST(request: Request) {
  let paymentRecorded = false;
  let razorpayPaymentId: string | undefined;
  let courseId: string | undefined;
  let amount = "0";

  try {
    const body = await request.json();
    const parsed = PublicEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { courseId: cId, paymentData, studentData } = parsed.data;
    const enrolledCourseId = cId;
    courseId = enrolledCourseId;
    razorpayPaymentId = paymentData.razorpayPaymentId;

    const valid = verifySignature(
      paymentData.razorpayOrderId,
      paymentData.razorpayPaymentId,
      paymentData.razorpaySignature
    );
    if (!valid) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(eq(courses.id, enrolledCourseId), eq(courses.isActive, true), isNull(courses.deletedAt))
      )
      .limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    amount = course.price;

    const email = studentData.email.trim().toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const plainPassword = studentData.password;
    const hashedPassword = await bcrypt.hash(plainPassword, 12);
    let lmsId = generatePublicLmsId();

    let student: typeof users.$inferSelect | undefined;

    try {
      student = await db.transaction(async (tx) => {
        const newStudent = await insertUniqueStudent(
          {
            name: studentData.name,
            email,
            phone: studentData.phone,
            hashedPassword,
            collegeName: studentData.collegeName,
            lmsId,
          },
          tx
        );
        lmsId = newStudent.lmsId!;

        await tx.insert(studentCourses).values({
          studentId: newStudent.id,
          courseId: enrolledCourseId,
          batchId: null,
          organisationId: null,
          enrollmentSource: "public",
        });

        await tx.insert(payments).values({
          organisationId: null,
          courseId: enrolledCourseId,
          adminId: null,
          amount,
          slotsCount: 1,
          razorpayOrderId: paymentData.razorpayOrderId,
          razorpayPaymentId: paymentData.razorpayPaymentId,
          status: "success",
        });

        paymentRecorded = true;
        return newStudent;
      });
    } catch (txErr) {
      console.error("[public/enroll] transaction failed:", txErr);
      try {
        await db.insert(payments).values({
          organisationId: null,
          courseId: enrolledCourseId,
          adminId: null,
          amount,
          slotsCount: 1,
          razorpayOrderId: paymentData.razorpayOrderId,
          razorpayPaymentId: paymentData.razorpayPaymentId,
          status: "success",
        });
        paymentRecorded = true;
      } catch (payErr) {
        console.error("[public/enroll] payment record failed:", payErr);
      }
      return NextResponse.json(
        { error: "Enrollment failed", paymentRecorded },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        { error: "Enrollment failed", paymentRecorded },
        { status: 500 }
      );
    }

    await logAction({
      action: "PUBLIC_ENROLLMENT",
      entity: "Student",
      entityId: student.id,
      metadata: { courseId: enrolledCourseId, city: studentData.city },
      ipAddress: getClientIp(request),
    });

    try {
      await sendWelcomeEmail({
        to: email,
        name: studentData.name,
        lmsId,
        password: plainPassword,
        courseTitle: course.title,
        loginUrl: `${getAppUrl()}/login`,
      });
    } catch (err) {
      console.error("[public/enroll] welcome email failed:", err);
    }

    const setCookie = await buildSessionSetCookieHeader({
      id: student.id,
      email: student.email,
      name: student.name,
      role: "student",
      lmsId,
    });

    const response = NextResponse.json({
      success: true,
      user: { email: student.email, name: student.name, lmsId },
    });
    response.headers.set("Set-Cookie", setCookie);
    return response;
  } catch (err) {
    console.error("[public/enroll]", err);
    return NextResponse.json(
      {
        error: "Enrollment failed",
        paymentRecorded,
        paymentId: razorpayPaymentId,
      },
      { status: 500 }
    );
  }
}

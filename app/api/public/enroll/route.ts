import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses, payments, studentCourses, users } from "@/lib/db/schema";
import { PublicEnrollmentSchema } from "@/lib/validations/public-enrollment";
import { verifySignature, fetchRazorpayOrder } from "@/lib/razorpay";
import { logAction, getClientIp } from "@/lib/audit";
import { sendWelcomeEmail } from "@/lib/email";
import { generatePaymentInvoice } from "@/lib/invoice";
import { buildSessionSetCookieHeader } from "@/lib/session-token";
import { getAppUrl } from "@/lib/app-url";

export const runtime = "nodejs";

function generatePublicLmsId(): string {
  return `LMS${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

async function insertUniqueStudent(data: {
  name: string;
  email: string;
  phone: string;
  hashedPassword: string;
  collegeName: string;
  lmsId: string;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [student] = await db
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

async function rollbackEnrolledStudent(studentId: string) {
  try {
    await db.delete(studentCourses).where(eq(studentCourses.studentId, studentId));
    await db.delete(users).where(eq(users.id, studentId));
  } catch (rollbackErr) {
    console.error("[public/enroll] rollback failed:", rollbackErr);
  }
}

export async function POST(request: Request) {
  let paymentRecorded = false;
  let razorpayPaymentId: string | undefined;
  let amount = "0";

  try {
    const body = await request.json();
    const parsed = PublicEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { courseId: enrolledCourseId, paymentData, studentData } = parsed.data;
    razorpayPaymentId = paymentData.razorpayPaymentId;

    const valid = verifySignature(
      paymentData.razorpayOrderId,
      paymentData.razorpayPaymentId,
      paymentData.razorpaySignature
    );
    if (!valid) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    // Source of truth: Razorpay order notes + paid amount (not client courseId alone)
    let order: Awaited<ReturnType<typeof fetchRazorpayOrder>>;
    try {
      order = await fetchRazorpayOrder(paymentData.razorpayOrderId);
    } catch (fetchErr) {
      console.error("[public/enroll] order fetch failed:", fetchErr);
      return NextResponse.json({ error: "Could not verify payment order" }, { status: 400 });
    }

    const orderCourseId = order.notes.courseId?.trim();
    if (!orderCourseId || orderCourseId !== enrolledCourseId) {
      return NextResponse.json(
        { error: "Payment order does not match the selected course" },
        { status: 400 }
      );
    }

    const [existingPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.razorpayPaymentId, paymentData.razorpayPaymentId))
      .limit(1);
    if (existingPayment) {
      return NextResponse.json(
        { error: "This payment has already been used for an enrollment" },
        { status: 409 }
      );
    }

    const [course] = await db
      .select()
      .from(recordCourses)
      .where(
        and(
          eq(recordCourses.id, enrolledCourseId),
          eq(recordCourses.isActive, true),
          isNull(recordCourses.deletedAt)
        )
      )
      .limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const expectedPaise = Math.round(parseFloat(String(course.price)) * 100);
    if (!Number.isFinite(expectedPaise) || order.amount !== expectedPaise) {
      return NextResponse.json(
        { error: "Payment amount does not match course price" },
        { status: 400 }
      );
    }
    amount = (order.amount / 100).toFixed(2);

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
    let paymentId: string | undefined;

    try {
      const newStudent = await insertUniqueStudent({
        name: studentData.name,
        email,
        phone: studentData.phone,
        hashedPassword,
        collegeName: studentData.collegeName,
        lmsId,
      });
      student = newStudent;
      lmsId = newStudent.lmsId!;

      await db.insert(studentCourses).values({
        studentId: newStudent.id,
        liveCourseId: null,
        recordCourseId: enrolledCourseId,
        batchId: null,
        organisationId: null,
        enrollmentSource: "public",
      });

      const [paymentRow] = await db
        .insert(payments)
        .values({
          organisationId: null,
          liveCourseId: null,
          recordCourseId: enrolledCourseId,
          adminId: null,
          amount,
          slotsCount: 1,
          razorpayOrderId: paymentData.razorpayOrderId,
          razorpayPaymentId: paymentData.razorpayPaymentId,
          status: "success",
        })
        .returning({ id: payments.id });

      paymentId = paymentRow?.id;
      paymentRecorded = true;
    } catch (txErr) {
      if (student?.id) {
        await rollbackEnrolledStudent(student.id);
        student = undefined;
      }
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (/pay_razorpay_payment_id|unique|duplicate/i.test(msg) && /razorpay/i.test(msg)) {
        return NextResponse.json(
          { error: "This payment has already been used for an enrollment" },
          { status: 409 }
        );
      }
      console.error("[public/enroll] transaction failed:", txErr);
      return NextResponse.json(
        { error: "Enrollment failed", paymentRecorded: false },
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
      let invoice: Awaited<ReturnType<typeof generatePaymentInvoice>> | null = null;
      if (paymentId) {
        try {
          invoice = await generatePaymentInvoice(paymentId, {
            customerName: studentData.name,
          });
        } catch (invoiceErr) {
          console.error("[public/enroll] invoice generation failed:", invoiceErr);
        }
      }

      await sendWelcomeEmail({
        to: email,
        name: studentData.name,
        lmsId,
        password: plainPassword,
        courseTitle: course.title,
        loginUrl: `${getAppUrl()}/login`,
        invoiceUrl: invoice?.absoluteUrl,
        invoiceAttachment: invoice
          ? { filename: invoice.filename, content: invoice.pdfBuffer }
          : undefined,
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

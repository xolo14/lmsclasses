import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses, widgetLeads } from "@/lib/db/schema";
import {
  checkWidgetSubmitRateLimit,
  resolveWidgetApiKey,
  widgetJson,
} from "@/lib/widget/widget-auth";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { widgetOptionsResponse } from "@/lib/widget/widget-cors";
import { widgetSubmitSchema } from "@/lib/validations/widget";
import {
  createWidgetLeadOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
} from "@/lib/razorpay";
import { isTestKey } from "@/lib/api-key-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  const auth = await resolveWidgetApiKey(null, request, { checkDomain: false });
  return widgetOptionsResponse(auth.context?.apiKey ?? null, request);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = widgetSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        message: "Invalid form data",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const auth = await resolveWidgetApiKey(data.key, request);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  const rateError = await checkWidgetSubmitRateLimit(ctx, request);
  if (rateError) return rateError;

  const courseId = ctx.apiKey.courseId;
  if (!courseId) {
    return widgetJson(
      ctx,
      request,
      { error: "INVALID_KEY", message: "API key is not linked to a course" },
      400
    );
  }

  const [course] = await db
    .select({
      id: recordCourses.id,
      title: recordCourses.title,
      price: recordCourses.price,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);

  if (!course || !course.isActive) {
    return widgetJson(ctx, request, { error: "COURSE_UNAVAILABLE", message: "Course unavailable" }, 404);
  }

  const price = parseFloat(course.price);
  const amountPaise = Math.round(price * 100);

  const [converted] = await db
    .select({ id: widgetLeads.id })
    .from(widgetLeads)
    .where(
      and(
        eq(widgetLeads.email, data.email),
        eq(widgetLeads.courseId, courseId),
        eq(widgetLeads.convertedToStudent, true)
      )
    )
    .limit(1);

  if (converted) {
    return widgetJson(ctx, request, {
      alreadyEnrolled: true,
      message: "You're already enrolled in this course",
    });
  }

  const [lead] = await db
    .insert(widgetLeads)
    .values({
      apiKeyId: ctx.apiKey.id,
      apiKeyName: ctx.apiKey.name,
      courseId: course.id,
      courseName: course.title,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone.replace(/\D/g, "").slice(-10),
      college: data.college ?? null,
      yearOfStudy: data.yearOfStudy ?? null,
      degree: data.degree ?? null,
      paymentStatus: "initiated",
      amountAttempted: amountPaise,
      landingPageUrl: data.landingPageUrl ?? null,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: request.headers.get("user-agent"),
    })
    .returning();

  let orderId: string;
  if (isTestKey(ctx.apiKey)) {
    orderId = `order_test_${lead.id.replace(/-/g, "").slice(0, 12)}`;
  } else {
    if (!isRazorpayConfigured() || !getRazorpayKeyId()) {
      return widgetJson(
        ctx,
        request,
        { error: "PAYMENT_UNAVAILABLE", message: "Payment is temporarily unavailable" },
        503
      );
    }
    const order = await createWidgetLeadOrder(price, {
      leadId: lead.id,
      courseId: course.id,
      apiKeyId: ctx.apiKey.id,
    });
    orderId = order.id;
  }

  await db
    .update(widgetLeads)
    .set({ razorpayOrderId: orderId, updatedAt: new Date() })
    .where(eq(widgetLeads.id, lead.id));

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "form_submitted",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
  });
  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "payment_initiated",
    leadId: lead.id,
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
    metadata: { orderId },
  });

  return widgetJson(
    ctx,
    request,
    {
      leadId: lead.id,
      razorpayOrderId: orderId,
      amount: amountPaise,
      currency: "INR",
      courseName: course.title,
      razorpayKeyId: getRazorpayKeyId(),
    },
    201
  );
}

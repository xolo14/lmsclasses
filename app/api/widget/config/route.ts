import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses } from "@/lib/db/schema";
import { getRazorpayKeyId } from "@/lib/razorpay";
import { resolveWidgetApiKey, widgetJson } from "@/lib/widget/widget-auth";
import { logWidgetEvent } from "@/lib/widget/widget-events";
import { widgetOptionsResponse, withWidgetCors } from "@/lib/widget/widget-cors";
import { YEAR_OF_STUDY_OPTIONS } from "@/lib/validations/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const auth = await resolveWidgetApiKey(key, request, { checkDomain: false });
  return widgetOptionsResponse(auth.context?.apiKey ?? null, request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const auth = await resolveWidgetApiKey(key, request, { logInvalid: true });
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  if (!ctx.apiKey.courseId) {
    return withWidgetCors(
      NextResponse.json({ error: "INVALID_KEY", message: "API key is not linked to a course" }, { status: 400 }),
      ctx.apiKey,
      request
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
    .where(eq(recordCourses.id, ctx.apiKey.courseId))
    .limit(1);

  if (!course || !course.isActive) {
    return widgetJson(
      ctx,
      request,
      { error: "COURSE_UNAVAILABLE", message: "Course is not available" },
      404
    );
  }

  const price = parseFloat(course.price);
  const razorpayKeyId = getRazorpayKeyId();

  await logWidgetEvent({
    apiKey: ctx.apiKey,
    eventType: "widget_loaded",
    ipAddress: ctx.ipAddress,
    domain: ctx.domain,
  });

  return widgetJson(ctx, request, {
    courseId: course.id,
    courseName: course.title,
    price,
    currency: "INR",
    razorpayKeyId,
    orgName: "LMS Classes",
    formConfig: {
      fields: ["fullName", "email", "phone", "college", "yearOfStudy", "degree"],
      yearOptions: YEAR_OF_STUDY_OPTIONS,
    },
  });
}

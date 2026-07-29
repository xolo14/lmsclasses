import { NextResponse } from "next/server";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { getRecordingsForApiKey } from "@/lib/partner-recordings-service";
import { widgetOptionsResponse, withWidgetCors } from "@/lib/widget/widget-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/recordings";

/**
 * Partner API: all published videos for the record courses on this key.
 * Auth: Authorization: Bearer <api_key> (get_recordings only — no enroll form/link).
 * Query: ?courseId=<uuid> optional filter to one allowed course.
 */
export async function OPTIONS(request: Request) {
  return widgetOptionsResponse(null, request);
}

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "get_recordings", ENDPOINT);
  if (auth.error) {
    return withWidgetCors(auth.error, null, request);
  }
  const ctx = auth.context!;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const courses = await getRecordingsForApiKey(ctx.apiKey, courseId);

    if (courseId && courses.length === 0) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        withWidgetCors(
          NextResponse.json(
            {
              error: "COURSE_NOT_ALLOWED",
              message: "This API key cannot access the requested course",
            },
            { status: 403 }
          ),
          ctx.apiKey,
          request
        ),
        { requestBody: { courseId } }
      );
    }

    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      withWidgetCors(
        NextResponse.json({
          courses,
          totalCourses: courses.length,
          totalRecordings: courses.reduce((n, c) => n + c.recordings.length, 0),
        }),
        ctx.apiKey,
        request
      )
    );
  } catch (err) {
    console.error("[external/recordings] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      withWidgetCors(
        NextResponse.json(
          { error: "INTERNAL_ERROR", message: "Internal server error" },
          { status: 500 }
        ),
        ctx.apiKey,
        request
      )
    );
  }
}

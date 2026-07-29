import { NextResponse } from "next/server";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { getRecordingsForApiKey } from "@/lib/partner-recordings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/recordings";

/**
 * Partner API: list published recording-class videos for courses allowed on this key.
 * Auth: Authorization: Bearer <api_key> (requires get_recordings permission)
 * Query: ?courseId=<uuid> optional filter to one allowed course
 */
export async function GET(request: Request) {
  const auth = await requireApiKey(request, "get_recordings", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const courses = await getRecordingsForApiKey(ctx.apiKey, courseId);

    if (courseId && courses.length === 0) {
      return finishApiKeyRequest(
        ctx,
        ENDPOINT,
        NextResponse.json(
          {
            error: "COURSE_NOT_ALLOWED",
            message: "This API key cannot access the requested course",
          },
          { status: 403 }
        ),
        { requestBody: { courseId } }
      );
    }

    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({
        courses,
        totalCourses: courses.length,
        totalRecordings: courses.reduce((n, c) => n + c.recordings.length, 0),
      })
    );
  } catch (err) {
    console.error("[external/recordings] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

import { NextResponse } from "next/server";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { getCoursesForApiKey } from "@/lib/partner-course-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/courses";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "get_course_list", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const courses = await getCoursesForApiKey(ctx.apiKey);
    return finishApiKeyRequest(ctx, ENDPOINT, NextResponse.json({ courses }));
  } catch (err) {
    console.error("[external/courses] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

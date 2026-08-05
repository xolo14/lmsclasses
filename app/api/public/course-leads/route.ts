import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courseLeads } from "@/lib/db/schema";
import { courseLeadSchema } from "@/lib/validations/course-lead";
import { formatApiError } from "@/lib/utils";
import { getClientIp } from "@/lib/audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request) ?? "unknown";
    const limited = checkRateLimit(`course-leads:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) {
      const rl = rateLimitResponse(limited.retryAfterSec);
      return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = courseLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatApiError(parsed.error.flatten(), "Invalid lead data") },
        { status: 400 }
      );
    }

    const { name, phone, courseSlug, courseTitle } = parsed.data;

    const [lead] = await db
      .insert(courseLeads)
      .values({ name, phone, courseSlug, courseTitle })
      .returning({ id: courseLeads.id });

    return NextResponse.json({ success: true, id: lead?.id }, { status: 201 });
  } catch (err) {
    console.error("[public/course-leads]", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}

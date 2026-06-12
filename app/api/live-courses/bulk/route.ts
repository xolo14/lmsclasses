import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { liveCourses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { courseSchema } from "@/lib/validations";
import { ensureUniqueLiveCourseSlug } from "@/lib/slug";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Input must be an array of courses" }, { status: 400 });
    }

    const parsedCourses: any[] = [];
    
    // Validate all items first
    for (let i = 0; i < body.length; i++) {
      const item = body[i];
      const parsed = courseSchema.safeParse(item);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        const formatted = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join("; ");
        return NextResponse.json({ error: `Row ${i + 1}: ${formatted}` }, { status: 400 });
      }

      const slug = await ensureUniqueLiveCourseSlug(parsed.data.title);

      parsedCourses.push({
        title: parsed.data.title,
        description: parsed.data.description,
        price: parsed.data.price.toString(),
        demoUrl: parsed.data.demoUrl,
        duration: parsed.data.duration,
        slug,
        createdBy: session!.user.id,
      });
    }

    // Single batch insert query (atomic in PostgreSQL)
    const insertedCourses = await db
      .insert(liveCourses)
      .values(parsedCourses)
      .returning();

    // Log audit logs after successful insertion
    for (const course of insertedCourses) {
      try {
        await logAction({
          userId: session!.user.id,
          role: session!.user.role,
          action: "CREATED_LIVE_COURSE",
          entity: "LiveCourse",
          entityId: course.id,
          metadata: { title: course.title, importMode: "bulk" },
          ipAddress: getClientIp(request),
        });
      } catch (auditErr) {
        console.error(`[POSTBulkLiveCourses] Audit logging failed for course ${course.id}:`, auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      successCount: insertedCourses.length,
      courses: insertedCourses,
    }, { status: 201 });

  } catch (err) {
    console.error("[POSTBulkLiveCourses] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to bulk create live courses";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

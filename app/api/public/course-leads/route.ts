import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courseLeads } from "@/lib/db/schema";
import { courseLeadSchema } from "@/lib/validations/course-lead";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = courseLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

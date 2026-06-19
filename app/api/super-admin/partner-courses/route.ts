import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const courses = await db
    .select({
      id: recordCourses.id,
      name: recordCourses.title,
      slug: recordCourses.slug,
      price: recordCourses.price,
      description: recordCourses.description,
      isActive: recordCourses.isActive,
    })
    .from(recordCourses)
    .where(and(eq(recordCourses.isActive, true), isNull(recordCourses.deletedAt)));

  return NextResponse.json(
    courses.map((c) => ({
      name: c.name,
      slug: c.slug,
      price: parseFloat(c.price),
      description: c.description,
      isActive: c.isActive,
    }))
  );
}

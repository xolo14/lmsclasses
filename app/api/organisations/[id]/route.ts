import { NextResponse } from "next/server";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organisations,
  users,
  payments,
  slots,
  studentCourses,
  courses,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { PATCHOrganisation, DELETEOrganisation } from "@/lib/api-handlers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;
  const { id } = await params;

  const [org] = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      email: organisations.email,
      phone: organisations.phone,
      address: organisations.address,
      logoUrl: organisations.logoUrl,
      isActive: organisations.isActive,
      jobPortalAccess: organisations.jobPortalAccess,
      createdAt: organisations.createdAt,
      adminName: users.name,
      adminEmail: users.email,
    })
    .from(organisations)
    .leftJoin(users, eq(organisations.adminId, users.id))
    .where(and(eq(organisations.id, id), isNull(organisations.deletedAt)))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [studentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.organisationId, id), eq(users.role, "student")));

  const orgPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.organisationId, id))
    .orderBy(desc(payments.createdAt));

  const orgStudents = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      lmsId: users.lmsId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      courseTitle: courses.title,
    })
    .from(users)
    .leftJoin(studentCourses, eq(studentCourses.studentId, users.id))
    .leftJoin(courses, eq(studentCourses.courseId, courses.id))
    .where(and(eq(users.organisationId, id), eq(users.role, "student")))
    .orderBy(desc(users.createdAt));

  const orgSlots = await db
    .select()
    .from(slots)
    .where(eq(slots.organisationId, id));

  return NextResponse.json({
    ...org,
    studentCount: studentCount?.count ?? 0,
    payments: orgPayments,
    students: orgStudents,
    slots: orgSlots,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return PATCHOrganisation(request, id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return DELETEOrganisation(_request, id);
}

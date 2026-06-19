"use server";

import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/audit";
import { resolveOrganisationId } from "@/lib/api-auth";
import {
  assignCoursesToStudent,
  updateEnrollment,
  getStudentEnrollmentsRich,
  updateModuleProgress,
  listEnrollmentsForAdmin,
} from "@/lib/enrollment-service";
import {
  assignCoursesSchema,
  updateEnrollmentSchema,
  bulkAssignSchema,
  moduleProgressSchema,
  type AssignCoursesInput,
  type UpdateEnrollmentInput,
  type BulkAssignInput,
} from "@/lib/validations/enrollment";
import { headers } from "next/headers";

const ADMIN_ROLES = ["super_admin", "org_admin", "manager"] as const;

async function getActor() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined;
  const orgId =
    session.user.role === "org_admin" ? await resolveOrganisationId(session) : session.user.organisationId;
  return {
    userId: session.user.id,
    role: session.user.role,
    organisationId: orgId,
    ipAddress: ip,
  };
}

function canManage(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export async function assignCoursesAction(input: AssignCoursesInput) {
  const actor = await getActor();
  if (!actor || !canManage(actor.role)) {
    return { success: false as const, error: "Unauthorized" };
  }
  const parsed = assignCoursesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const result = await assignCoursesToStudent(parsed.data, actor);
  return { success: true as const, ...result };
}

export async function updateEnrollmentAction(enrollmentId: string, input: UpdateEnrollmentInput) {
  const actor = await getActor();
  if (!actor || !canManage(actor.role)) {
    return { success: false as const, error: "Unauthorized" };
  }
  const parsed = updateEnrollmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }
  return updateEnrollment(enrollmentId, parsed.data, actor);
}

export async function bulkAssignAction(input: BulkAssignInput) {
  const actor = await getActor();
  if (!actor || !canManage(actor.role)) {
    return { success: false as const, error: "Unauthorized" };
  }
  const parsed = bulkAssignSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }

  const matrix: { studentId: string; courseId: string; result: "enrolled" | "skipped" | "error"; message?: string }[] = [];

  for (const studentId of parsed.data.studentIds) {
    for (const courseId of parsed.data.courseIds) {
      const res = await assignCoursesToStudent(
        { studentId, courseIds: [courseId], ...parsed.data.config },
        actor
      );
      if (res.enrolled.length) {
        matrix.push({ studentId, courseId, result: "enrolled" });
      } else if (res.skipped.length) {
        matrix.push({ studentId, courseId, result: "skipped", message: res.skipped[0] });
      } else {
        matrix.push({ studentId, courseId, result: "error", message: res.errors[0] });
      }
    }
  }

  return { success: true as const, matrix };
}

export async function getStudentEnrollmentsAction(studentId: string) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  if (actor.role === "student" && actor.userId !== studentId) {
    return { success: false as const, error: "Forbidden" };
  }
  if (!canManage(actor.role) && actor.userId !== studentId) {
    return { success: false as const, error: "Forbidden" };
  }
  const data = await getStudentEnrollmentsRich(studentId);
  return { success: true as const, data };
}

export async function updateModuleProgressAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    return { success: false as const, error: "Unauthorized" };
  }
  const parsed = moduleProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const result = await updateModuleProgress({
    ...parsed.data,
    studentId: session.user.id,
    moduleTitle: `Module ${parsed.data.moduleIndex + 1}`,
    durationSeconds: parsed.data.watchedSeconds,
  });
  return { success: true as const, ...result };
}

export async function listEnrollmentsAction(filters: Parameters<typeof listEnrollmentsForAdmin>[0]) {
  const actor = await getActor();
  if (!actor || !canManage(actor.role)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (actor.role === "org_admin" && actor.organisationId) {
    filters = { ...filters, orgId: actor.organisationId };
  }
  const data = await listEnrollmentsForAdmin(filters);
  return { success: true as const, data };
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { listEnrolledStudentsForCourse, type CertActor } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super_admin" && session.user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId");
  const courseType = searchParams.get("courseType") as "live" | "record" | null;
  const templateId = searchParams.get("templateId") ?? undefined;
  const eligibleOnly = searchParams.get("eligibleOnly") === "true";
  if (!courseId || !courseType) {
    return NextResponse.json({ error: "courseId and courseType required" }, { status: 400 });
  }

  const actor: CertActor = {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "Admin",
    organisationId:
      session.user.role === "org_admin"
        ? await resolveOrganisationId(session)
        : session.user.organisationId ?? null,
  };

  const data = await listEnrolledStudentsForCourse(actor, courseId, courseType, templateId, {
    eligibleOnly,
  });
  return NextResponse.json(data);
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import {
  bulkIssueCertificates,
  issueCertificate,
  listIssuedCertificates,
  type CertActor,
} from "@/lib/services/certificate-service";
import { bulkIssueSchema, issueCertificateSchema } from "@/lib/validations/certificate";

export const dynamic = "force-dynamic";

async function getActor(): Promise<CertActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "super_admin" && session.user.role !== "org_admin") return null;
  const organisationId =
    session.user.role === "org_admin"
      ? await resolveOrganisationId(session)
      : session.user.organisationId ?? null;
  return {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "Admin",
    organisationId,
  };
}

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const data = await listIssuedCertificates(actor, {
    studentId: searchParams.get("studentId") ?? undefined,
    courseId: searchParams.get("courseId") ?? undefined,
    templateId: searchParams.get("templateId") ?? undefined,
    isRevoked:
      searchParams.get("isRevoked") === "true"
        ? true
        : searchParams.get("isRevoked") === "false"
          ? false
          : undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 50,
  });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (body.bulk) {
    const parsed = bulkIssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const result = await bulkIssueCertificates(actor, parsed.data);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  const parsed = issueCertificateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await issueCertificate(actor, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

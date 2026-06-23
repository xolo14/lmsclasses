import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import {
  createTemplate,
  listTemplates,
  type CertActor,
} from "@/lib/services/certificate-service";
import { createTemplateSchema } from "@/lib/validations/certificate";

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
  const data = await listTemplates(actor, {
    courseId: searchParams.get("courseId") ?? undefined,
    isActive: searchParams.get("isActive") === "true" ? true : undefined,
    search: searchParams.get("search") ?? undefined,
  });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createTemplate(actor, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

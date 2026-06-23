import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import {
  deleteTemplate,
  duplicateTemplate,
  getTemplate,
  updateTemplate,
  type CertActor,
} from "@/lib/services/certificate-service";
import { updateTemplateSchema } from "@/lib/validations/certificate";

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

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const data = await getTemplate(actor, id);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    await updateTemplate(actor, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    await deleteTemplate(actor, id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const newName = typeof body.newName === "string" ? body.newName : "Copy";
  try {
    const result = await duplicateTemplate(actor, id, newName);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

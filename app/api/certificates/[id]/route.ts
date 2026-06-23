import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { resendCertificateEmail, revokeCertificate, type CertActor } from "@/lib/services/certificate-service";
import { revokeCertificateSchema } from "@/lib/validations/certificate";

export const dynamic = "force-dynamic";

async function getActor(session: Session): Promise<CertActor> {
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

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    await resendCertificateEmail(await getActor(session), id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const parsed = revokeCertificateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    await revokeCertificate(await getActor(session), id, parsed.data.reason);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { getCertificatePdfBuffer } from "@/lib/services/certificate-service";
import type { CertActor } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function toActor(session: Session): Promise<CertActor> {
  const organisationId =
    session.user.role === "org_admin"
      ? await resolveOrganisationId(session)
      : session.user.organisationId ?? null;
  return {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "User",
    organisationId,
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const actor = await toActor(session);
    const { buffer, filename } = await getCertificatePdfBuffer(actor, id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

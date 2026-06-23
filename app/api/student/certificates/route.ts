import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listIssuedCertificates, type CertActor } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("courseId") ?? undefined;

  const actor: CertActor = {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "Student",
    organisationId: session.user.organisationId ?? null,
  };

  const data = await listIssuedCertificates(actor, {
    courseId,
    isRevoked: false,
    limit: 100,
  });
  return NextResponse.json(data.certificates);
}

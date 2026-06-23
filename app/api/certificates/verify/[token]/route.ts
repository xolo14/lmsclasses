import { NextResponse } from "next/server";
import { getVerificationByToken } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const cert = await getVerificationByToken(token);
  if (!cert) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json({
    found: true,
    isRevoked: cert.isRevoked,
    studentName: cert.studentNameSnapshot,
    courseName: cert.courseNameSnapshot,
    orgName: cert.orgNameSnapshot,
    certificateNumber: cert.certificateNumber,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    revokeReason: cert.revokeReason,
    certificateId: cert.id,
  });
}

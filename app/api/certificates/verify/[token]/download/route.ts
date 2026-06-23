import { NextResponse } from "next/server";
import { getVerificationByToken } from "@/lib/services/certificate-service";
import { readCertificatePdf } from "@/lib/certificate-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const cert = await getVerificationByToken(token);
  if (!cert || cert.isRevoked) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readCertificatePdf(cert);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${cert.certificateNumber}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF file not found" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { processPendingAutoIssuances } from "@/lib/services/certificate-service";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "super_admin" && session.user.role !== "org_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.role === "org_admin") {
    await resolveOrganisationId(session);
  }

  try {
    const result = await processPendingAutoIssuances();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

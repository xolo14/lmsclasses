import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";

const organisationLogoSchema = z.object({
  // Allow clearing by sending null or empty string
  logoUrl: z
    .preprocess((v) => {
      if (v === "" || v === undefined) return null;
      return v;
    }, z.string().optional().nullable())
    .optional(),
});

function isValidLogoValue(v: string | null | undefined) {
  if (!v) return true; // allow null/undefined for clearing
  if (v.startsWith("data:image/")) return true;
  if (v.startsWith("http://") || v.startsWith("https://")) return true;
  return false;
}

export async function PATCH(request: Request) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = organisationLogoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid logo URL" },
      { status: 400 }
    );
  }

  const organisationId = session!.user.organisationId;
  if (!organisationId) {
    return NextResponse.json({ error: "Organisation not found" }, { status: 404 });
  }

  const logoUrl = parsed.data.logoUrl ?? null;
  if (!isValidLogoValue(logoUrl)) {
    return NextResponse.json({ error: "Invalid logo URL format" }, { status: 400 });
  }

  await db
    .update(organisations)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(organisations.id, organisationId));

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_ORGANISATION_LOGO",
    entity: "Organisation",
    entityId: organisationId,
    metadata: { logoSet: !!logoUrl },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}


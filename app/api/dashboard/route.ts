import { NextResponse } from "next/server";
import { GETDashboardStats, GETHistory, GETSlots } from "@/lib/api-handlers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") as "org" | "global" | null;

  const { error, session } = await requireAuth();
  if (error) return error;

  const organisationId =
    scope === "org" ? session!.user.organisationId ?? undefined : undefined;

  return GETDashboardStats(scope ?? "global", organisationId);
}

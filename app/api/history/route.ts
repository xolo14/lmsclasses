import { NextResponse } from "next/server";
import { GETHistory } from "@/lib/api-handlers";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  return GETHistory(session!.user.organisationId!);
}

import { NextResponse } from "next/server";
import { GETSlots } from "@/lib/api-handlers";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: { courseId: string } }
) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;

  return GETSlots(params.courseId, session!.user.organisationId!);
}

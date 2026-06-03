import { NextResponse } from "next/server";
import { GETSlots } from "@/lib/api-handlers";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error, session } = await requireAuth(["org_admin"]);
  if (error) return error;
  const { courseId } = await params;

  return GETSlots(courseId, session!.user.organisationId!);
}

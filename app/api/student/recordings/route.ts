import { auth } from "@/lib/auth";
import { GETStudentRecordings } from "@/lib/api-trash-recordings";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return GETStudentRecordings(session.user.id);
}

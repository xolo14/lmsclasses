import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { updateModuleProgress } from "@/lib/enrollment-service";
import { moduleProgressSchema } from "@/lib/validations/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const parsed = moduleProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await updateModuleProgress({
    enrollmentId: parsed.data.enrollmentId,
    studentId: session!.user.id,
    moduleIndex: parsed.data.moduleIndex,
    moduleTitle: parsed.data.moduleTitle ?? `Module ${parsed.data.moduleIndex + 1}`,
    watchedSeconds: parsed.data.watchedSeconds,
    durationSeconds: parsed.data.durationSeconds ?? parsed.data.watchedSeconds,
    isCompleted: parsed.data.isCompleted ?? false,
    notes: parsed.data.notes,
  });

  return NextResponse.json(result);
}

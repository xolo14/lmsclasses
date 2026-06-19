import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { updateModuleProgress } from "@/lib/enrollment-service";
import { moduleProgressSchema } from "@/lib/validations/enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const body = await request.json();
  const parsed = moduleProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await updateModuleProgress({
    ...parsed.data,
    studentId: session!.user.id,
    moduleTitle: body.moduleTitle ?? `Module ${parsed.data.moduleIndex + 1}`,
    durationSeconds: body.durationSeconds ?? parsed.data.watchedSeconds,
    notes: parsed.data.notes,
  });

  return NextResponse.json(result);
}

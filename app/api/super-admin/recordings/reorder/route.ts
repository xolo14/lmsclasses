import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courseRecordings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { reorderRecordingsSchema } from "@/lib/validations/course-recording";

export async function PATCH(request: Request) {
  const { error } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  const body = await request.json();
  const parsed = reorderRecordingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    for (const { id, sortOrder } of parsed.data.updates) {
      await tx
        .update(courseRecordings)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(courseRecordings.id, id));
    }
  });

  return NextResponse.json({ success: true });
}

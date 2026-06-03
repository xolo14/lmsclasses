import { GETStudentLiveClasses } from "@/lib/api-handlers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { requireAuth } = await import("@/lib/api-auth");
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;
  const { courseId } = await params;

  const tab = new URL(request.url).searchParams.get("tab");
  const validTab =
    tab === "completed" || tab === "recordings" ? tab : "active";

  return GETStudentLiveClasses(courseId, session!.user.id, validTab);
}

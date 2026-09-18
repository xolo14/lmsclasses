import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobApplications, jobPostings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { findUploadDiskPath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["hr", "super_admin", "manager"]);
  if (error) return error;

  const { id } = await params;
  const [row] = await db
    .select({
      resumeUrl: jobApplications.resumeUrl,
      hrId: jobPostings.hrId,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobApplications.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (session!.user.role === "hr" && row.hrId !== session!.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const match = row.resumeUrl.match(/^\/uploads\/resumes\/([^/]+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Resume is not stored on this server" }, { status: 404 });
  }

  const diskPath = findUploadDiskPath(["resumes", match[1]]);
  if (!diskPath) {
    return NextResponse.json({ error: "Resume file not found" }, { status: 404 });
  }

  const buf = await readFile(diskPath);
  const ext = path.extname(match[1]).toLowerCase();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Disposition": `inline; filename="${match[1]}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

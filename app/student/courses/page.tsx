"use client";

import Link from "next/link";
import { BookOpen, Video, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyEnrollments } from "@/lib/hooks/useEnrollments";
import { formatDateTime } from "@/lib/utils";

type EnrollmentRow = {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  courseThumbnail: string | null;
  accessType: string;
  liveAccess: boolean;
  recordedAccess: boolean;
  completionPercentage: number;
  recordedModulesWatched: number;
  totalModules: number;
  nextLiveClassAt: string | null;
  certificate: boolean;
  status: string;
};

export default function StudentCoursesPage() {
  const { data: enrollments = [], isLoading } = useMyEnrollments();

  const active = enrollments.filter((e) => e.status === "active");
  const completed = enrollments.filter((e) => e.status === "completed");

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-swiss-red pl-4">
        <p className="swiss-label">Student portal</p>
        <h1 className="text-2xl font-bold">My Courses</h1>
        <p className="text-sm text-swiss-muted mt-1">
          {active.length} active · {completed.length} completed
        </p>
      </div>

      {isLoading ? (
        <p className="text-swiss-muted">Loading…</p>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center text-swiss-muted border border-swiss-black/10">
          <BookOpen className="h-12 w-12 opacity-40" />
          <p>You haven&apos;t enrolled in any courses yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => {
            const row = e as unknown as EnrollmentRow;
            return (
            <article
              key={row.enrollmentId}
              className={`border border-swiss-black/10 bg-swiss-white flex flex-col ${
                row.status === "revoked" ? "opacity-60" : ""
              }`}
            >
              <div className="aspect-video bg-swiss-cream relative">
                {row.courseThumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.courseThumbnail} alt="" className="h-full w-full object-cover" />
                ) : null}
                <div className="absolute top-2 left-2 flex gap-1">
                  {row.liveAccess && (
                    <Badge className="bg-swiss-red text-white text-[10px]">LIVE</Badge>
                  )}
                  {row.recordedAccess && (
                    <Badge className="bg-amber-600 text-white text-[10px]">REC</Badge>
                  )}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-3">
                <h2 className="font-bold leading-snug">{row.courseTitle}</h2>
                <div>
                  <div className="flex justify-between text-xs text-swiss-muted mb-1">
                    <span>Progress</span>
                    <span>{row.completionPercentage}%</span>
                  </div>
                  <div className="h-1.5 bg-swiss-black/10">
                    <div
                      className="h-full bg-swiss-red"
                      style={{ width: `${row.completionPercentage}%` }}
                    />
                  </div>
                </div>
                {row.liveAccess && row.nextLiveClassAt && (
                  <p className="text-xs text-swiss-muted flex items-center gap-1">
                    <Video className="h-3.5 w-3.5 text-swiss-red" />
                    Next live: {formatDateTime(row.nextLiveClassAt)}
                  </p>
                )}
                {row.recordedAccess && (
                  <p className="text-xs text-swiss-muted flex items-center gap-1">
                    <Film className="h-3.5 w-3.5" />
                    {row.recordedModulesWatched}/{row.totalModules || "—"} modules
                  </p>
                )}
                {row.certificate && (
                  <Badge variant="outline" className="w-fit text-emerald-700">
                    Certificate earned
                  </Badge>
                )}
                <Button asChild className="mt-auto w-full">
                  <Link href={`/student/courses/${row.courseId}`}>Open course →</Link>
                </Button>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

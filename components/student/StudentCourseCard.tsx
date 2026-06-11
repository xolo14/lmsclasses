"use client";

import Link from "next/link";
import { BookOpen, Video, Lock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type StudentEnrollment = {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug?: string | null;
  courseThumbnail?: string | null;
  courseDescription?: string | null;
  batchId?: string | null;
  enrollmentSource: string;
  hasLiveAccess: boolean;
};

function SourceBadge({ source }: { source: string }) {
  if (source === "super_admin") {
    return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Direct Enrollment</Badge>;
  }
  if (source === "public") {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Self Enrolled</Badge>;
  }
  return null;
}

function AccessRow({
  label,
  enabled,
  lockedHint,
}: {
  label: string;
  enabled: boolean;
  lockedHint?: string;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${enabled ? "text-emerald-400" : "text-muted-foreground"}`}
      title={!enabled ? lockedHint : undefined}
    >
      {enabled ? <CheckCircle className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function StudentCourseCard({ enrollment }: { enrollment: StudentEnrollment }) {
  const lockedHint = "Not available for your enrollment";

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
        {enrollment.courseThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={enrollment.courseThumbnail}
            alt={enrollment.courseTitle}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <BookOpen className="h-10 w-10" />
          </div>
        )}
      </div>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={enrollment.enrollmentSource} />
        </div>
        <h3 className="line-clamp-2 font-semibold">{enrollment.courseTitle}</h3>
        {enrollment.courseDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{enrollment.courseDescription}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <AccessRow label="Course Recordings" enabled />
          <AccessRow
            label="Live Classes"
            enabled={enrollment.hasLiveAccess}
            lockedHint={lockedHint}
          />
          <AccessRow
            label="Live Recordings"
            enabled={enrollment.hasLiveAccess}
            lockedHint={lockedHint}
          />
        </div>
        <Button asChild className="w-full">
          <Link href={`/student/courses/${enrollment.courseId}`}>
            <Video className="mr-2 h-4 w-4" />
            Go to Course →
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

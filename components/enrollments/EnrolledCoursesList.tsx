"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { EnrollmentWithCourse } from "@/lib/enrollment-service";

const accessBadge: Record<string, { label: string; className: string }> = {
  live: { label: "LIVE", className: "bg-swiss-red/15 text-swiss-red border-swiss-red/30" },
  recorded: { label: "REC", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  both: { label: "BOTH", className: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
};

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  active: "success",
  paused: "warning",
  revoked: "destructive",
  expired: "secondary",
  completed: "outline",
};

type Props = {
  enrollments: EnrollmentWithCourse[];
  onEdit?: (enrollment: EnrollmentWithCourse) => void;
};

export function EnrolledCoursesList({ enrollments, onEdit }: Props) {
  if (!enrollments.length) {
    return <p className="text-sm text-swiss-muted py-4">No courses enrolled yet.</p>;
  }

  return (
    <div className="overflow-x-auto border border-swiss-black/10">
      <table className="w-full text-sm">
        <thead className="bg-swiss-cream text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-swiss-muted">
          <tr>
            <th className="p-3 text-left">Course</th>
            <th className="p-3 text-left">Type</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Progress</th>
            <th className="p-3 text-left">Enrolled</th>
            {onEdit && <th className="p-3" />}
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => {
            const badge = accessBadge[e.accessType] ?? accessBadge.recorded;
            return (
              <tr key={e.id} className="border-t border-swiss-black/10">
                <td className="p-3 font-medium">{e.courseTitle}</td>
                <td className="p-3">
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant={statusVariant[e.status] ?? "outline"}>{e.status}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <div className="h-1.5 flex-1 bg-swiss-black/10">
                      <div
                        className="h-full bg-swiss-red"
                        style={{ width: `${e.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums">{e.completionPercentage}%</span>
                  </div>
                </td>
                <td className="p-3 text-swiss-muted text-xs">
                  {e.enrolledAt ? formatDateTime(e.enrolledAt) : "—"}
                </td>
                {onEdit && (
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => onEdit(e)}>
                      Edit
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

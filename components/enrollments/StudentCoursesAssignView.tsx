"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { EnrolledCoursesList } from "@/components/enrollments/EnrolledCoursesList";
import { AssignCoursesForm } from "@/components/enrollments/AssignCoursesForm";
import { useStudentEnrollments } from "@/lib/hooks/useEnrollments";
import { Button } from "@/components/ui/button";

type Props = {
  studentId: string;
  backHref: string;
  backLabel?: string;
  /** Super admin: block assignment for organisation students. */
  directStudentsOnly?: boolean;
};

export function StudentCoursesAssignView({
  studentId,
  backHref,
  backLabel = "← Students",
  directStudentsOnly = false,
}: Props) {
  const searchParams = useSearchParams();
  const preselectedCourseId = searchParams.get("courseId");

  const { data: student } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: async () => {
      const res = await fetch("/api/students");
      const json = await res.json();
      if (!res.ok) throw new Error("Failed");
      const list = Array.isArray(json) ? json : json.data ?? [];
      return list.find((s: { id: string }) => s.id === studentId) ?? null;
    },
    enabled: !!studentId,
  });

  const { data: enrollments = [], refetch } = useStudentEnrollments(studentId);

  const { data: assignEligibility, isLoading: eligibilityLoading } = useQuery({
    queryKey: ["assign-eligibility", studentId, directStudentsOnly],
    queryFn: async () => {
      const res = await fetch(`/api/enrollments/assignable-courses?studentId=${studentId}`);
      const json = await res.json().catch(() => ({}));
      if (res.status === 403) {
        return { allowed: false as const, message: json.error ?? "Not allowed" };
      }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to verify student");
      }
      return { allowed: true as const };
    },
    enabled: !!studentId && directStudentsOnly,
  });

  const blocked = directStudentsOnly && assignEligibility && !assignEligibility.allowed;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Course assignments"
        description={student?.name ? `Manage enrollments for ${student.name}` : "Assign and manage courses"}
      >
        <Button variant="outline" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-swiss-black/10 bg-swiss-white p-4">
            <p className="swiss-label">Student</p>
            <p className="font-bold text-lg mt-1">{student?.name ?? "…"}</p>
            <p className="text-sm text-swiss-muted">{student?.email}</p>
            <p className="text-sm text-swiss-muted">{student?.phone}</p>
          </div>
          <div>
            <p className="swiss-label mb-3">Currently enrolled</p>
            <EnrolledCoursesList enrollments={enrollments} />
          </div>
        </div>
        <div className="lg:col-span-3 border border-swiss-black/10 bg-swiss-white p-6">
          <p className="swiss-label mb-4">Assign new courses</p>
          {directStudentsOnly && eligibilityLoading ? (
            <p className="text-sm text-swiss-muted">Checking student eligibility…</p>
          ) : blocked ? (
            <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {assignEligibility.message}
              <p className="mt-2 text-swiss-muted text-xs">
                Use the org admin portal to assign courses to students linked to an organisation.
              </p>
            </div>
          ) : (
            <AssignCoursesForm
              studentId={studentId}
              onSuccess={() => refetch()}
              preselectedCourseIds={preselectedCourseId ? [preselectedCourseId] : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

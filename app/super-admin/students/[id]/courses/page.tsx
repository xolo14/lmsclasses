"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { EnrolledCoursesList } from "@/components/enrollments/EnrolledCoursesList";
import { AssignCoursesForm } from "@/components/enrollments/AssignCoursesForm";
import { useStudentEnrollments } from "@/lib/hooks/useEnrollments";
import { Button } from "@/components/ui/button";

export default function StudentCoursesAssignPage() {
  const params = useParams();
  const studentId = params.id as string;

  const { data: student } = useQuery({
    queryKey: ["student-detail", studentId],
    queryFn: async () => {
      const res = await fetch("/api/students");
      const list = await res.json();
      if (!res.ok) throw new Error("Failed");
      const found = (Array.isArray(list) ? list : list.data ?? []).find(
        (s: { id: string }) => s.id === studentId
      );
      return found ?? null;
    },
    enabled: !!studentId,
  });

  const { data: enrollments = [], refetch } = useStudentEnrollments(studentId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Course assignments"
        description={student?.name ? `Manage enrollments for ${student.name}` : "Assign and manage courses"}
      >
        <Button variant="outline" asChild>
          <Link href="/super-admin/students">← Students</Link>
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
          <AssignCoursesForm studentId={studentId} onSuccess={() => refetch()} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { StudentCoursesAssignView } from "@/components/enrollments/StudentCoursesAssignView";

function AssignContent() {
  const params = useParams();
  const studentId = params.id as string;

  return (
    <StudentCoursesAssignView
      studentId={studentId}
      backHref="/manager/students"
      backLabel="← Students"
    />
  );
}

export default function ManagerStudentCoursesAssignPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground p-6">Loading…</div>}>
      <AssignContent />
    </Suspense>
  );
}

"use client";

import { useParams } from "next/navigation";
import { StudentCoursesAssignView } from "@/components/enrollments/StudentCoursesAssignView";

export default function ManagerStudentCoursesAssignPage() {
  const params = useParams();
  const studentId = params.id as string;

  return (
    <StudentCoursesAssignView
      studentId={studentId}
      backHref="/org-admin/students"
      backLabel="← Students"
    />
  );
}

"use client";

import { EnrollmentsAdminPage } from "@/components/enrollments/EnrollmentsAdminPage";

export default function ManagerStudentsPage() {
  return (
    <EnrollmentsAdminPage
      basePath="/manager"
      title="Students"
      description="All students and course enrollments. Add students, assign courses, and manage access."
    />
  );
}

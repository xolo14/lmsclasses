"use client";

import { EnrollmentsAdminPage } from "@/components/enrollments/EnrollmentsAdminPage";

export default function SuperAdminEnrollmentsPage() {
  return (
    <EnrollmentsAdminPage
      basePath="/super-admin"
      title="Enrollment"
      description="Students and course enrollments in one table. One row per student per course."
      assignDirectStudentsOnly
    />
  );
}

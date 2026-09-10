import { redirect } from "next/navigation";

export default function OrgAdminEnrollmentsPage() {
  redirect("/super-admin/enrollments?tab=enrollments");
}

import { redirect } from "next/navigation";

export default function StudentsPage() {
  redirect("/super-admin/enrollments?tab=students");
}

import { GETOngoingCourses } from "@/lib/api-trash-recordings";

export async function GET() {
  return GETOngoingCourses();
}

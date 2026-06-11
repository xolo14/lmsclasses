import type { Metadata } from "next";
import { getPublicCourses } from "@/lib/public-courses";
import { CoursesListing } from "@/components/public/CoursesListing";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All Courses | LMSClasses",
  description: "Browse all professional training programs with live classes and recordings.",
};

export default async function CoursesPage() {
  const courses = await getPublicCourses();
  const mapped = courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description ?? "",
    price: parseFloat(c.price),
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    level: c.level ?? "Beginner",
    language: c.language ?? "English",
    totalHours: c.totalHours ?? undefined,
    totalLectures: c.totalLectures ?? undefined,
    certificate: c.certificate ?? true,
    demoVideoUrl: c.demoVideoUrl ?? undefined,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">All Training Programs</h1>
        <Badge className="bg-brand-cyan/20 text-brand-cyan">{mapped.length} courses</Badge>
      </div>
      <CoursesListing courses={mapped} />
    </div>
  );
}

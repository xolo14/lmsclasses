"use client";

import Link from "next/link";
import { CourseCard, type CourseCardProps } from "@/components/public/CourseCard";
import { ArrowRight } from "lucide-react";

type Course = CourseCardProps & { isFeatured?: boolean };

export function FeaturedCoursesSection({ courses }: { courses: Course[] }) {
  const courseList = Array.isArray(courses) ? courses : [];
  const featured = courseList.filter((c) => c.isFeatured);
  const base = featured.length > 0 ? featured.slice(0, 6) : courseList.slice(0, 6);

  return (
    <section id="courses-section" className="bg-bg-base pb-12 pt-6 md:pb-16 md:pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">
              Our courses
            </p>
            <h2 className="mt-3 font-display text-3xl text-text-primary md:text-4xl">
              Learn with purpose
            </h2>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-sm font-medium text-text-muted transition-colors hover:text-brand-cyan"
          >
            View all courses
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {base.map((course) => (
            <CourseCard key={course.id} {...course} variant="editorial" />
          ))}
        </div>

        {base.length === 0 && (
          <p className="py-12 text-center text-text-muted">Courses coming soon.</p>
        )}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { CourseCard, type CourseCardProps } from "@/components/public/CourseCard";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

type Course = CourseCardProps & { isFeatured?: boolean };

export function FeaturedCoursesSection({ courses }: { courses: Course[] }) {
  const courseList = Array.isArray(courses) ? courses : [];
  const featured = courseList.filter((c) => c.isFeatured);
  const base = featured.length > 0 ? featured.slice(0, 20) : courseList.slice(0, 20);

  return (
    <LandingSection id="courses-section">
      <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!py-10 md:!py-12">
        <div className="flex flex-col gap-6 border-b border-neutral-950/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={landingLayout.label}>Catalogue</p>
            <h2 className="mt-3 max-w-lg text-3xl font-bold tracking-[-0.03em] text-neutral-950 md:text-4xl">
              Learn with purpose.
            </h2>
          </div>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-950"
          >
            View all courses <span className="text-swiss-red">→</span>
          </Link>
        </div>
      </LandingCell>

      {base.length === 0 ? (
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12">
          <p className="text-sm text-neutral-500">Courses coming soon.</p>
        </LandingCell>
      ) : (
        base.map((course) => (
          <LandingCell
            key={course.id}
            span="col-span-4 md:col-span-4 lg:col-span-3"
            className="!border-r !border-neutral-950/10 !py-0 md:!px-0 lg:[&:nth-child(4n)]:border-r-0"
          >
            <CourseCard {...course} variant="swiss" />
          </LandingCell>
        ))
      )}
    </LandingSection>
  );
}

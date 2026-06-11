"use client";

import { useState } from "react";
import Link from "next/link";
import { CourseCard, type CourseCardProps } from "@/components/public/CourseCard";
import { DemoVideoModal } from "@/components/public/DemoVideoModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Course = CourseCardProps & { isFeatured?: boolean };

const levels = ["All", "Beginner", "Intermediate", "Advanced"] as const;

export function FeaturedCoursesSection({ courses }: { courses: Course[] }) {
  const [filter, setFilter] = useState<(typeof levels)[number]>("All");
  const [demo, setDemo] = useState<{ url: string; title: string } | null>(null);

  const featured = courses.filter((c) => c.isFeatured);
  const base = featured.length > 0 ? featured.slice(0, 6) : courses.slice(0, 6);

  const filtered =
    filter === "All" ? base : base.filter((c) => c.level === filter);

  return (
    <section id="courses-section" className="bg-bg-base py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-text-primary">Explore Our Programs</h2>
          <p className="mt-2 text-text-muted">All courses designed with industry professionals</p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setFilter(level)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                filter === level
                  ? "bg-brand-cyan text-bg-base"
                  : "border border-bg-border text-text-muted hover:text-text-primary"
              )}
            >
              {level}
            </button>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              {...course}
              onDemoClick={(url, title) => setDemo({ url, title })}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-text-muted">No courses match this filter.</p>
        )}

        <div className="mt-10 text-center">
          <Button asChild className="bg-brand-cyan text-bg-base hover:bg-brand-cyan-light">
            <Link href="/courses">View All Courses</Link>
          </Button>
        </div>
      </div>

      <DemoVideoModal
        isOpen={!!demo}
        onClose={() => setDemo(null)}
        videoUrl={demo?.url ?? ""}
        courseTitle={demo?.title ?? ""}
      />
    </section>
  );
}

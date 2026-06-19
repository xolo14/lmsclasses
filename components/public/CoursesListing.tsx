"use client";

import { useMemo, useState, useEffect } from "react";
import { CourseCard, type CourseCardProps } from "@/components/public/CourseCard";
import { landingLayout } from "@/components/public/landing/landing-grid";
import { cn } from "@/lib/utils";

type Course = CourseCardProps;

const swissField =
  "h-11 w-full border border-swiss-black/20 bg-swiss-white px-4 text-sm text-swiss-black placeholder:text-swiss-muted focus:border-swiss-black focus:outline-none focus:ring-0";

export function CoursesListing({ courses }: { courses: Course[] }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [level, setLevel] = useState("All");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const courseList = Array.isArray(courses) ? courses : [];
    let list = [...courseList];
    if (debounced) {
      const q = debounced.toLowerCase();
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      );
    }
    if (level !== "All") {
      list = list.filter((c) => c.level === level);
    }
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    return list;
  }, [courses, debounced, level, sort]);

  return (
    <div className="py-8 md:py-10">
      <div className="grid grid-cols-1 gap-4 border-b border-swiss-black/10 pb-8 md:grid-cols-12 md:gap-6">
        <div className="md:col-span-5">
          <label htmlFor="course-search" className={cn(landingLayout.label, "mb-2 block")}>
            Search
          </label>
          <input
            id="course-search"
            type="search"
            placeholder="Find a program…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={swissField}
          />
        </div>
        <div className="md:col-span-3">
          <label htmlFor="course-level" className={cn(landingLayout.label, "mb-2 block")}>
            Level
          </label>
          <select
            id="course-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={swissField}
          >
            <option value="All">All levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
        <div className="md:col-span-4">
          <label htmlFor="course-sort" className={cn(landingLayout.label, "mb-2 block")}>
            Sort
          </label>
          <select
            id="course-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={swissField}
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price — low to high</option>
            <option value="price-desc">Price — high to low</option>
          </select>
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-swiss-muted">
        {filtered.length} program{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="py-16 text-sm text-swiss-muted">No courses match your filters.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 border-t border-l border-swiss-black/10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <div key={course.id} className="border-b border-r border-swiss-black/10">
              <CourseCard {...course} variant="swiss" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

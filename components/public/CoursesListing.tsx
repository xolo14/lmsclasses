"use client";

import { useMemo, useState, useEffect } from "react";
import { CourseCard, type CourseCardProps } from "@/components/public/CourseCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Course = CourseCardProps;

export function CoursesListing({ courses }: { courses: Course[] }) {
  const courseList = Array.isArray(courses) ? courses : [];
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [level, setLevel] = useState("All");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
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
  }, [courseList, debounced, level, sort]);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-bg-border bg-bg-card text-text-primary sm:max-w-xs"
        />
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-full border-bg-border bg-bg-card sm:w-40">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Levels</SelectItem>
            <SelectItem value="Beginner">Beginner</SelectItem>
            <SelectItem value="Intermediate">Intermediate</SelectItem>
            <SelectItem value="Advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full border-bg-border bg-bg-card sm:w-48">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price Low-High</SelectItem>
            <SelectItem value="price-desc">Price High-Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-text-muted">No courses match your filters.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} {...course} />
          ))}
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { Clock, BookOpen, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseCardProps {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  thumbnailUrl?: string;
  level: string;
  language: string;
  totalHours?: number;
  totalLectures?: number;
  certificate: boolean;
  demoVideoUrl?: string;
  onDemoClick?: (videoUrl: string, title: string) => void;
}

const levelColors: Record<string, string> = {
  Beginner: "bg-status-green/20 text-status-green border-status-green/30",
  Intermediate: "bg-status-yellow/20 text-status-yellow border-status-yellow/30",
  Advanced: "bg-status-red/20 text-status-red border-status-red/30",
};

export function CourseCard({
  slug,
  title,
  description,
  price,
  thumbnailUrl,
  level,
  language,
  totalHours,
  totalLectures,
  certificate,
  demoVideoUrl,
  onDemoClick,
}: CourseCardProps) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-all duration-300 hover:-translate-y-1 hover:bg-bg-card-hover hover:shadow-lg hover:shadow-brand-cyan/10">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-brand-cyan-dim/40 to-bg-base">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-cyan/60">
            <BookOpen className="h-12 w-12" />
          </div>
        )}
        {demoVideoUrl && onDemoClick && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDemoClick(demoVideoUrl, title);
            }}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <span className="rounded-full bg-brand-cyan px-4 py-2 text-sm font-semibold text-bg-base">
              ▶ Watch Demo
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              levelColors[level] ?? levelColors.Beginner
            )}
          >
            {level}
          </span>
          <span className="rounded-full border border-bg-border bg-bg-base px-2 py-0.5 text-xs text-text-muted">
            {language}
          </span>
        </div>

        <h3 className="line-clamp-2 font-semibold text-text-primary">{title}</h3>
        <p className="line-clamp-2 text-sm text-text-muted">{description}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          {totalHours != null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {totalHours}h
            </span>
          )}
          {totalLectures != null && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {totalLectures} lectures
            </span>
          )}
          {certificate && (
            <span className="flex items-center gap-1 text-brand-cyan">
              <Award className="h-3.5 w-3.5" />
              Certificate
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <p className="text-2xl font-bold text-brand-cyan">₹{price.toLocaleString("en-IN")}</p>
          <Link
            href={`/courses/${slug}`}
            className="block w-full rounded-lg bg-brand-cyan py-2.5 text-center text-sm font-semibold text-bg-base transition-colors hover:bg-brand-cyan-light"
          >
            View Course →
          </Link>
        </div>
      </div>
    </div>
  );
}

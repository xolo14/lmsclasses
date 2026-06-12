"use client";

import Link from "next/link";
import { Clock, BookOpen, Award, Video } from "lucide-react";
import { resolveCourseThumbnailUrl } from "@/lib/course-thumbnail";
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
  isFeatured?: boolean;
  variant?: "default" | "editorial";
  onDemoClick?: (videoUrl: string, title: string) => void;
}

const levelColors: Record<string, string> = {
  Beginner: "bg-status-green/20 text-status-green border-status-green/30",
  Intermediate: "bg-status-yellow/20 text-status-yellow border-status-yellow/30",
  Advanced: "bg-status-red/20 text-status-red border-status-red/30",
};

const levelBadgeLabel: Record<string, string> = {
  Beginner: "Starter",
  Intermediate: "Popular",
  Advanced: "Master",
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
  isFeatured,
  variant = "default",
  onDemoClick,
}: CourseCardProps) {
  const imageSrc = resolveCourseThumbnailUrl(thumbnailUrl, demoVideoUrl);
  const showPopular = isFeatured || level === "Intermediate";
  const badgeLabel = showPopular ? "Popular" : (levelBadgeLabel[level] ?? level);

  if (variant === "editorial") {
    return (
      <article className="group flex flex-col overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-colors hover:border-bg-border/80 hover:bg-bg-card-hover">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-cyan-dim/30 to-bg-base">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-brand-cyan/40">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                showPopular
                  ? "bg-brand-cyan/15 text-brand-cyan"
                  : "bg-bg-base text-text-muted"
              )}
            >
              {badgeLabel}
            </span>
            <p className="font-display text-xl italic text-gold md:text-2xl">
              ₹{price.toLocaleString("en-IN")}
            </p>
          </div>

          <h3 className="font-display text-xl leading-snug text-text-primary">{title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-muted">{description}</p>

          <div className="mt-auto flex items-center justify-between border-t border-bg-border pt-5">
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <Video className="h-3.5 w-3.5" />
              Live sessions
            </span>
            <Link
              href={`/courses/${slug}`}
              className="text-sm font-medium text-brand-cyan transition-colors hover:text-brand-cyan-light"
            >
              Enroll →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-bg-border bg-bg-card transition-all duration-300 hover:-translate-y-1 hover:bg-bg-card-hover hover:shadow-lg hover:shadow-brand-cyan/10">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-brand-cyan-dim/40 to-bg-base">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={title} className="h-full w-full object-cover" />
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

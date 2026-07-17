"use client";

import { Clock, BookOpen, Award, Video } from "lucide-react";
import { resolveCourseThumbnailUrl } from "@/lib/course-thumbnail";
import { cn } from "@/lib/utils";
import { ViewCourseDialog, useViewCourse } from "@/components/public/ViewCourseDialog";

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
  variant?: "default" | "editorial" | "swiss";
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
  const hasPrice = Number.isFinite(price) && price > 0;
  const showPopular = isFeatured || level === "Intermediate";
  const badgeLabel = showPopular ? "Popular" : (levelBadgeLabel[level] ?? level);
  const { open, setOpen, requestView } = useViewCourse(slug);

  if (variant === "swiss") {
    return (
      <article className="group flex h-full flex-col bg-white">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={title}
              className="h-full w-full object-cover transition-[filter] duration-300 group-hover:grayscale"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300">
              <BookOpen className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col border-t border-neutral-950/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {badgeLabel}
            </p>
            {hasPrice ? (
              <p className="text-lg font-bold tabular-nums text-neutral-950">
                ₹{price.toLocaleString("en-IN")}
              </p>
            ) : null}
          </div>

          <h3 className="mt-4 text-lg font-bold leading-snug tracking-[-0.02em] text-neutral-950">
            {title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">{description}</p>

          <div className="mt-auto flex items-center justify-between border-t border-neutral-950/10 pt-5">
            <span className="text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              {language}
            </span>
            <button
              type="button"
              onClick={requestView}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-950 transition-colors hover:text-[#FF0A18]"
            >
              View →
            </button>
          </div>
        </div>
        <ViewCourseDialog
          open={open}
          onOpenChange={setOpen}
          slug={slug}
          courseTitle={title}
        />
      </article>
    );
  }

  if (variant === "editorial") {
    return (
      <article className="group flex flex-col overflow-hidden rounded-xl border border-swiss-black/10 bg-swiss-white transition-colors hover:border-swiss-black/10/80 hover:bg-swiss-cream">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-swiss-red/15 to-swiss-black">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex h-full items-center justify-center text-swiss-red/40">
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
                  ? "bg-swiss-red/15 text-swiss-red"
                  : "bg-swiss-cream text-swiss-muted"
              )}
            >
              {badgeLabel}
            </span>
            {hasPrice ? (
              <p className="font-display text-xl italic text-gold md:text-2xl">
                ₹{price.toLocaleString("en-IN")}
              </p>
            ) : null}
          </div>

          <h3 className="font-display text-xl leading-snug text-swiss-black">{title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-swiss-muted">{description}</p>

          <div className="mt-auto flex items-center justify-between border-t border-swiss-black/10 pt-5">
            <span className="flex items-center gap-1.5 text-xs text-swiss-muted">
              <Video className="h-3.5 w-3.5" />
              Live sessions
            </span>
            <button
              type="button"
              onClick={requestView}
              className="text-sm font-medium text-swiss-red transition-colors hover:text-swiss-red-light"
            >
              View Course →
            </button>
          </div>
        </div>
        <ViewCourseDialog
          open={open}
          onOpenChange={setOpen}
          slug={slug}
          courseTitle={title}
        />
      </article>
    );
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-swiss-black/10 bg-swiss-white transition-all duration-300 hover:-translate-y-1 hover:bg-swiss-cream hover:shadow-lg hover:shadow-swiss-red/10">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-swiss-red/20 to-swiss-black">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-swiss-red/60">
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
            <span className="rounded-full bg-swiss-red px-4 py-2 text-sm font-semibold text-white">
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
          <span className="rounded-full border border-swiss-black/10 bg-swiss-cream px-2 py-0.5 text-xs text-swiss-muted">
            {language}
          </span>
        </div>

        <h3 className="line-clamp-2 font-semibold text-swiss-black">{title}</h3>
        <p className="line-clamp-2 text-sm text-swiss-muted">{description}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-swiss-muted">
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
            <span className="flex items-center gap-1 text-swiss-red">
              <Award className="h-3.5 w-3.5" />
              Certificate
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          {hasPrice ? (
            <p className="text-2xl font-bold text-swiss-red">
              ₹{price.toLocaleString("en-IN")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={requestView}
            className="block w-full rounded-lg bg-swiss-red py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-swiss-red-light"
          >
            View Course →
          </button>
        </div>
      </div>
      <ViewCourseDialog
        open={open}
        onOpenChange={setOpen}
        slug={slug}
        courseTitle={title}
      />
    </div>
  );
}

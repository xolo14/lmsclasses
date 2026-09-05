import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicDemoCourseById } from "@/lib/public-demo";
import { ResolvedVideoPlayer } from "@/components/ui/resolved-video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Mail, GraduationCap } from "lucide-react";

/** Hostinger hbuild has no DATABASE_URL at compile time — never ISR-prerender DB pages. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await getPublicDemoCourseById(id);
  if (!course) return { title: "Demo Not Found" };
  const description = course.description ?? `Watch the free demo for ${course.title}`;
  return {
    title: `${course.title} Demo | LMS Classes`,
    description,
    openGraph: {
      title: `${course.title} Demo | LMS Classes`,
      description,
      url: `https://lmsclasses.com/demo/${course.id}`,
      siteName: "LMS Classes",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${course.title} Demo | LMS Classes`,
      description,
    },
  };
}

export default async function PublicCourseDemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getPublicDemoCourseById(id);
  if (!course) notFound();

  const enrollHref =
    course.courseType === "record" && course.slug
      ? `/courses/${course.slug}`
      : `/courses`;
  const contactHref = `mailto:info@lmsclasses.com?subject=${encodeURIComponent(
    `Inquiry: ${course.title} demo`
  )}&body=${encodeURIComponent(
    `Hi LMS Classes,\n\nI watched the demo for "${course.title}" and would like to know more about enrollment.\n\nThanks.`
  )}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <PageHeader
        title="Course Demo"
        description="Watch the demo video and explore this program."
      />

      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <ResolvedVideoPlayer
          videoUrl={course.demoUrl}
          title={`Demo video for ${course.title}`}
          autoPlay
        />
      </div>

      <Card className="border border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-foreground">{course.title}</h2>
            <div className="flex items-center gap-2">
              <Badge variant={course.isActive ? "success" : "destructive"}>
                {course.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {course.courseType}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {course.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{course.description}</p>
          ) : null}

          <div className="flex flex-wrap gap-3 border-t border-border/40 pt-4">
            <Button asChild className="gap-2">
              <Link href={enrollHref}>
                <GraduationCap className="h-4 w-4" />
                Enroll
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href={contactHref}>
                <Mail className="h-4 w-4" />
                Contact us
              </a>
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
            <span>Course Enrolment count: {course.enrolledCount} enrolled</span>
            <Link href="/courses" className="text-swiss-red hover:underline">
              Browse all courses
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

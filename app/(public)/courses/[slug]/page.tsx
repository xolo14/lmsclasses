import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Check, Lock } from "lucide-react";
import { getPublicCourseBySlug } from "@/lib/public-courses";
import { EnrollmentCard } from "@/components/public/CourseDetailClient";
import { ResolvedVideoPlayer } from "@/components/ui/resolved-video-player";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

/** Hostinger hbuild has no DATABASE_URL at compile time — never ISR-prerender DB pages. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublicCourseBySlug(slug);
  if (!course) return { title: "Course Not Found" };
  return {
    title: `${course.title} | LMSClasses`,
    description: course.description ?? undefined,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublicCourseBySlug(slug);
  if (!course) notFound();

  const price = parseFloat(course.price);
  const demoUrl = course.demoVideoUrl;

  return (
    <>
      <LandingSection className="bg-swiss-white">
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-8" className="!py-10 md:!py-12">
          <nav className="text-xs font-medium uppercase tracking-[0.16em] text-swiss-muted">
            <Link href="/" className="hover:text-swiss-red">
              Home
            </Link>
            {" / "}
            <Link href="/courses" className="hover:text-swiss-red">
              Courses
            </Link>
            {" / "}
            <span className="text-swiss-black">{course.title}</span>
          </nav>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-swiss-black md:text-4xl lg:text-5xl">
            {course.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-swiss-muted md:text-base">
            {course.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-swiss-muted">
            <span>{course.level}</span>
            <span>{course.language}</span>
            {course.updatedAt && (
              <span>Updated {format(new Date(course.updatedAt), "MMM d, yyyy")}</span>
            )}
            <span className="text-swiss-red">{course.enrolledCount} enrolled</span>
          </div>
        </LandingCell>
        <LandingCell
          span="col-span-4 md:col-span-8 lg:col-span-4"
          className="!border-l !border-swiss-black/10 !py-10 md:!py-12"
        >
          <EnrollmentCard
            courseId={course.id}
            courseTitle={course.title}
            price={price}
            thumbnailUrl={course.thumbnailUrl}
          />
        </LandingCell>
      </LandingSection>

      {course.whatYouLearn.length > 0 && (
        <LandingSection>
          <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-6">
            <p className={landingLayout.label}>Outcomes</p>
            <h2 className="mt-2 text-2xl font-bold text-swiss-black">What You&apos;ll Learn</h2>
          </LandingCell>
          {course.whatYouLearn.map((item) => (
            <LandingCell key={item} span="col-span-4 md:col-span-4 lg:col-span-4">
              <div className="flex items-start gap-2 text-sm text-swiss-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-swiss-red" />
                {item}
              </div>
            </LandingCell>
          ))}
        </LandingSection>
      )}

      {demoUrl && (
        <LandingSection bleed>
          <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12">
            <p className={landingLayout.label}>Preview</p>
            <h2 className="mt-2 mb-6 text-2xl font-bold text-swiss-black">Course Preview</h2>
            <div className="aspect-video overflow-hidden border border-swiss-black/10 bg-swiss-black">
              <ResolvedVideoPlayer videoUrl={demoUrl} title="Course preview" />
            </div>
          </LandingCell>
        </LandingSection>
      )}

      {course.syllabus.length > 0 && (
        <LandingSection>
          <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-6">
            <p className={landingLayout.label}>Syllabus</p>
            <h2 className="mt-2 text-2xl font-bold text-swiss-black">Course Syllabus</h2>
          </LandingCell>
          <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pt-0 space-y-2">
            {course.syllabus.map((mod, i) => (
              <details
                key={i}
                className="border border-swiss-black/10 bg-swiss-white px-4 py-3"
              >
                <summary className="cursor-pointer font-semibold text-swiss-black">
                  Week {mod.week ?? i + 1}: {mod.title ?? "Module"}
                </summary>
                {mod.topics && mod.topics.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-swiss-muted">
                    {mod.topics.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </details>
            ))}
          </LandingCell>
        </LandingSection>
      )}

      {course.requirements.length > 0 && (
        <LandingSection>
          <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12">
            <p className={landingLayout.label}>Requirements</p>
            <h2 className="mt-2 mb-4 text-2xl font-bold text-swiss-black">Requirements</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-swiss-muted">
              {course.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </LandingCell>
        </LandingSection>
      )}

      <LandingSection>
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-6">
          <p className={landingLayout.label}>Schedule</p>
          <h2 className="mt-2 text-2xl font-bold text-swiss-black">Upcoming Live Classes</h2>
        </LandingCell>
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pt-0">
          {course.liveClasses.length > 0 ? (
            <div className="overflow-x-auto border border-swiss-black/10">
              <table className="w-full text-sm">
                <thead className="bg-swiss-cream text-left text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-swiss-muted">
                  <tr>
                    <th className="p-3">Class Title</th>
                    <th className="p-3">Scheduled Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {course.liveClasses.map((lc, i) => (
                    <tr key={i} className="border-t border-swiss-black/10">
                      <td className="p-3">{lc.title}</td>
                      <td className="p-3">
                        {lc.scheduledAt
                          ? format(new Date(lc.scheduledAt), "MMM d, yyyy h:mm a")
                          : "—"}
                      </td>
                      <td className="p-3 capitalize">{lc.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-swiss-muted">More classes when you enroll.</p>
          )}
        </LandingCell>
      </LandingSection>

      <LandingSection bleed>
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12">
          <p className={landingLayout.label}>Recordings</p>
          <h2 className="mt-2 mb-6 text-2xl font-bold text-swiss-black">Recorded Sessions</h2>
          <div className="relative border border-swiss-black/10 bg-swiss-white p-6">
            <div className="space-y-2 blur-sm select-none">
              {Array.from({ length: Math.min(course.recordingsCount || 3, 5) }).map((_, i) => (
                <div key={i} className="h-10 bg-swiss-black/5" />
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-swiss-cream/80">
              <Lock className="mb-2 h-8 w-8 text-swiss-red" />
              <p className="text-sm font-medium text-swiss-black">
                Enroll to unlock all {course.recordingsCount} recorded sessions
              </p>
            </div>
          </div>
        </LandingCell>
      </LandingSection>
    </>
  );
}

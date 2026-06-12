import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Check, Lock } from "lucide-react";
import { getPublicCourseBySlug } from "@/lib/public-courses";
import { EnrollmentCard } from "@/components/public/CourseDetailClient";
import { EmbeddedVideoPlayer } from "@/components/ui/embedded-video-player";
import { resolveVideoEmbed } from "@/lib/video-embed";

export const revalidate = 60;

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
  const demoEmbed = demoUrl ? resolveVideoEmbed(demoUrl) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-8 lg:max-w-[65%]">
          <nav className="text-sm text-text-muted">
            <Link href="/" className="hover:text-brand-cyan">
              Home
            </Link>
            {" > "}
            <Link href="/courses" className="hover:text-brand-cyan">
              Courses
            </Link>
            {" > "}
            <span className="text-text-secondary">{course.title}</span>
          </nav>

          <div>
            <h1 className="text-3xl font-bold md:text-4xl">{course.title}</h1>
            <p className="mt-3 text-text-secondary">{course.description}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-text-muted">
              <span>{course.level}</span>
              <span>{course.language}</span>
              {course.updatedAt && (
                <span>Updated {format(new Date(course.updatedAt), "MMM d, yyyy")}</span>
              )}
              <span>{course.enrolledCount} students enrolled</span>
            </div>
          </div>

          {course.whatYouLearn.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">What You&apos;ll Learn</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {course.whatYouLearn.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {demoUrl && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">Course Preview</h2>
              <div className="aspect-video overflow-hidden rounded-lg bg-black">
                <EmbeddedVideoPlayer embed={demoEmbed} videoUrl={demoUrl} title="Course preview" />
              </div>
            </section>
          )}

          {course.syllabus.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">Course Syllabus</h2>
              <div className="space-y-2">
                {course.syllabus.map((mod, i) => (
                  <details
                    key={i}
                    className="rounded-lg border border-bg-border bg-bg-card px-4 py-3"
                  >
                    <summary className="cursor-pointer font-medium">
                      Week {mod.week ?? i + 1}: {mod.title ?? "Module"}
                    </summary>
                    {mod.topics && mod.topics.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-muted">
                        {mod.topics.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
            </section>
          )}

          {course.requirements.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold">Requirements</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-4 text-xl font-semibold">Upcoming Live Classes</h2>
            {course.liveClasses.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-bg-border">
                <table className="w-full text-sm">
                  <thead className="bg-bg-card text-left text-text-muted">
                    <tr>
                      <th className="p-3">Class Title</th>
                      <th className="p-3">Scheduled Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.liveClasses.map((lc, i) => (
                      <tr key={i} className="border-t border-bg-border">
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
              <p className="text-sm text-text-muted">More classes when you enroll.</p>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">Recorded Sessions</h2>
            <div className="relative rounded-lg border border-bg-border bg-bg-card p-6">
              <div className="space-y-2 blur-sm select-none">
                {Array.from({ length: Math.min(course.recordingsCount || 3, 5) }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-bg-border/50" />
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-base/60">
                <Lock className="mb-2 h-8 w-8 text-brand-cyan" />
                <p className="text-sm font-medium">
                  Enroll to unlock all {course.recordingsCount} recorded sessions
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:w-[35%]">
          <EnrollmentCard
            courseId={course.id}
            courseTitle={course.title}
            price={price}
            thumbnailUrl={course.thumbnailUrl}
          />
        </div>
      </div>
    </div>
  );
}

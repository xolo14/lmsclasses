import Link from "next/link";
import { getPublicCourses } from "@/lib/public-courses";
import { FeaturedCoursesSection } from "@/components/public/FeaturedCoursesSection";
import { LandingHero } from "@/components/public/LandingHero";
import { Button } from "@/components/ui/button";
import { BookOpen, Video, Briefcase, Award, Search, CreditCard, PlayCircle } from "lucide-react";

export const revalidate = 300;

export default async function LandingPage() {
  const courses = await getPublicCourses();
  const mapped = courses.map((c) => ({
    ...c,
    description: c.description ?? "",
    price: parseFloat(c.price),
    level: c.level ?? "Beginner",
    language: c.language ?? "English",
    certificate: c.certificate ?? true,
    isFeatured: c.isFeatured ?? false,
    demoVideoUrl: c.demoVideoUrl ?? undefined,
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    totalHours: c.totalHours ?? undefined,
    totalLectures: c.totalLectures ?? undefined,
  }));

  return (
    <>
      <LandingHero />

      <section id="how-it-works" className="border-y border-bg-border bg-bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">From Purchase to Learning in Minutes</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: 1,
                icon: Search,
                title: "Choose Your Course",
                desc: "Browse catalogue, view demos, check syllabus",
              },
              {
                step: 2,
                icon: CreditCard,
                title: "Enroll & Pay",
                desc: "One-click Razorpay checkout, secure payment",
              },
              {
                step: 3,
                icon: PlayCircle,
                title: "Start Learning",
                desc: "Instant access to live classes + recordings",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-cyan text-lg font-bold text-bg-base">
                  {item.step}
                </div>
                <item.icon className="mx-auto mb-3 h-8 w-8 text-brand-cyan" />
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FeaturedCoursesSection courses={mapped} />

      <section id="why-choose-us" className="bg-bg-card py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="mb-12 text-center text-3xl font-bold">Why Choose Us</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: Video,
                title: "Live Interactive Classes",
                desc: "Real-time learning with mentor Q&A",
              },
              {
                icon: BookOpen,
                title: "Lifetime Recordings",
                desc: "Re-watch at any time, no expiry",
              },
              {
                icon: Briefcase,
                title: "Integrated Job Portal",
                desc: "Apply to curated job openings after course completion",
              },
              {
                icon: Award,
                title: "Certificate on Completion",
                desc: "Industry-recognised certificate",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-bg-border border-l-4 border-l-brand-cyan bg-bg-base p-6"
              >
                <f.icon className="mb-3 h-8 w-8 text-brand-cyan" />
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-r from-brand-cyan-dim to-brand-cyan px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-bg-base md:text-3xl">
            Ready to Start Your Career Journey?
          </h2>
          <Button asChild className="mt-6 bg-bg-base text-brand-cyan hover:bg-bg-card">
            <Link href="/courses">Browse All Courses</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

import { getPublicCourses } from "@/lib/public-courses";

import { FeaturedCoursesSection } from "@/components/public/FeaturedCoursesSection";

import { LandingHero } from "@/components/public/LandingHero";

import { LandingStatsBand } from "@/components/public/LandingStatsBand";

import { LandingTestimonials } from "@/components/public/LandingTestimonials";

import { LandingCta } from "@/components/public/LandingCta";

import { BookOpen, Video, Briefcase, Award, Search, CreditCard, PlayCircle } from "lucide-react";



export const revalidate = 60;



export default async function LandingPage() {

  let courses: Awaited<ReturnType<typeof getPublicCourses>> = [];

  try {

    courses = await getPublicCourses();

  } catch (err) {

    console.error("[landing] getPublicCourses failed:", err);

  }

  const mapped = courses.map(({ demoVideoUrl: _d, ...c }) => ({

    ...c,

    description: c.description ?? "",

    price: parseFloat(c.price),

    level: c.level ?? "Beginner",

    language: c.language ?? "English",

    certificate: c.certificate ?? true,

    isFeatured: c.isFeatured ?? false,

    thumbnailUrl: c.thumbnailUrl ?? undefined,

    totalHours: c.totalHours ?? undefined,

    totalLectures: c.totalLectures ?? undefined,

  }));



  return (

    <>

      <LandingHero />

      <FeaturedCoursesSection courses={mapped} />

      <LandingStatsBand />



      <section id="how-it-works" className="bg-bg-base py-12 md:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-8 text-center">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">

              How it works

            </p>

            <h2 className="mt-3 font-display text-3xl text-text-primary md:text-4xl">

              Learning shouldn&apos;t be complicated

            </h2>

          </div>



          <div className="grid gap-6 md:grid-cols-3">

            {[

              {

                step: 1,

                icon: Search,

                title: "Choose your course",

                desc: "Browse our catalogue, preview demos, and find the program that fits your goals.",

              },

              {

                step: 2,

                icon: CreditCard,

                title: "Enroll securely",

                desc: "One-click Razorpay checkout with instant confirmation and secure payment.",

              },

              {

                step: 3,

                icon: PlayCircle,

                title: "Start learning",

                desc: "Get immediate access to live classes, recordings, and your student portal.",

              },

            ].map((item) => (

              <div

                key={item.step}

                className="relative overflow-hidden rounded-xl border border-bg-border bg-bg-card p-8 md:p-10"

              >

                <span

                  className="pointer-events-none absolute -right-2 -top-4 select-none font-display text-[80px] italic leading-none text-text-primary/[0.08]"

                  aria-hidden

                >

                  {item.step}

                </span>

                <item.icon className="mb-5 h-6 w-6 text-brand-cyan" />

                <h3 className="mb-3 text-lg font-semibold text-text-primary">{item.title}</h3>

                <p className="text-sm leading-relaxed text-text-muted">{item.desc}</p>

              </div>

            ))}

          </div>

        </div>

      </section>



      <section id="about" className="bg-bg-card py-12 md:py-16">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="mb-8 max-w-2xl">

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-cyan">

              Why LMS Classes

            </p>

            <h2 className="mt-3 font-display text-3xl text-text-primary md:text-4xl">

              Built for people who learn by doing

            </h2>

          </div>



          <div className="grid gap-8 sm:grid-cols-2">

            {[

              {

                icon: Video,

                title: "Live interactive classes",

                desc: "Real-time learning with mentor Q&A, project reviews, and peer collaboration.",

              },

              {

                icon: BookOpen,

                title: "Lifetime recordings",

                desc: "Re-watch every session at your own pace — no expiry, no limits.",

              },

              {

                icon: Briefcase,

                title: "Integrated job portal",

                desc: "Apply to curated openings from partner companies after course completion.",

              },

              {

                icon: Award,

                title: "Certificate on completion",

                desc: "Industry-recognised credentials that validate your skills to employers.",

              },

            ].map((f) => (

              <div key={f.title} className="flex gap-5">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-bg-border bg-bg-base">

                  <f.icon className="h-5 w-5 text-brand-cyan" />

                </div>

                <div>

                  <h3 className="mb-2 font-semibold text-text-primary">{f.title}</h3>

                  <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>



      <LandingTestimonials />

      <LandingCta />

    </>

  );

}


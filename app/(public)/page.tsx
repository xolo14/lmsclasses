import { getPublicCourses } from "@/lib/public-courses";
import { FeaturedCoursesSection } from "@/components/public/FeaturedCoursesSection";
import { LandingHero } from "@/components/public/LandingHero";
import { LandingStatsBand } from "@/components/public/LandingStatsBand";
import { LandingTestimonials } from "@/components/public/LandingTestimonials";
import { LandingCta } from "@/components/public/LandingCta";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

export const revalidate = 60;

const processSteps = [
  {
    step: "01",
    title: "Choose your course",
    desc: "Browse the catalogue, preview demos, and select the program that fits your goals.",
  },
  {
    step: "02",
    title: "Enroll securely",
    desc: "Razorpay checkout with instant confirmation and secure payment.",
  },
  {
    step: "03",
    title: "Start learning",
    desc: "Access live classes, recordings, and your student portal immediately.",
  },
];

const features = [
  {
    title: "Live interactive classes",
    desc: "Real-time learning with mentor Q&A, project reviews, and peer collaboration.",
  },
  {
    title: "Lifetime recordings",
    desc: "Re-watch every session at your own pace — no expiry, no limits.",
  },
  {
    title: "Integrated job portal",
    desc: "Apply to curated openings from partner companies after completion.",
  },
  {
    title: "Certificate on completion",
    desc: "Industry-recognised credentials that validate your skills to employers.",
  },
];

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

      <LandingSection id="how-it-works">
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-8">
          <p className={landingLayout.label}>Process</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.03em] text-neutral-950 md:text-4xl">
            Learning shouldn&apos;t be complicated.
          </h2>
        </LandingCell>
        {processSteps.map((item) => (
          <LandingCell
            key={item.step}
            span="col-span-4 md:col-span-4 lg:col-span-4"
            className="!border-r !border-neutral-950/10"
          >
            <p className="text-5xl font-bold tracking-[-0.05em] text-neutral-950/10">{item.step}</p>
            <h3 className="mt-4 text-lg font-bold text-neutral-950">{item.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">{item.desc}</p>
          </LandingCell>
        ))}
      </LandingSection>

      <LandingSection id="about" bleed>
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!pb-8">
          <p className={landingLayout.label}>Why LMS Classes</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-[-0.03em] text-neutral-950 md:text-4xl">
            Built for people who learn by doing.
          </h2>
        </LandingCell>
        {features.map((f) => (
          <LandingCell
            key={f.title}
            span="col-span-4 md:col-span-4 lg:col-span-6"
            className="!border-r !border-neutral-950/10"
          >
            <h3 className="text-base font-bold text-neutral-950">{f.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">{f.desc}</p>
          </LandingCell>
        ))}
      </LandingSection>

      <LandingTestimonials />
      <LandingCta />
    </>
  );
}

import { getPublicCourses } from "@/lib/public-courses";
import { CoursesListing } from "@/components/public/CoursesListing";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

/** Hostinger hbuild has no DATABASE_URL at compile time — never ISR-prerender DB pages. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "All Courses | LMS Classes",
  description: "Browse all professional training programs with live classes and recordings.",
};

export default async function CoursesPage() {
  const courses = await getPublicCourses();
  const mapped = courses.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description ?? "",
    price: parseFloat(c.price),
    thumbnailUrl: c.thumbnailUrl ?? undefined,
    level: c.level ?? "Beginner",
    language: c.language ?? "English",
    totalHours: c.totalHours ?? undefined,
    totalLectures: c.totalLectures ?? undefined,
    certificate: c.certificate ?? true,
  }));

  return (
    <>
      <LandingSection className="bg-swiss-white">
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-8" className="!py-12 md:!py-16">
          <p className={landingLayout.label}>Catalogue</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-swiss-black md:text-5xl lg:text-6xl">
            All training programs.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-swiss-muted md:text-base">
            Live classes, lifetime recordings, and job-ready outcomes — browse every program in
            one grid.
          </p>
        </LandingCell>
        <LandingCell
          span="col-span-4 md:col-span-8 lg:col-span-4"
          className="flex flex-col justify-end !border-l !border-swiss-black/10 !py-12 md:!py-16"
        >
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-swiss-muted">
            Available
          </p>
          <p className="mt-2 text-5xl font-bold tracking-[-0.04em] text-swiss-red md:text-6xl">
            {mapped.length}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-swiss-black">Courses</p>
        </LandingCell>
      </LandingSection>

      <LandingSection>
        <LandingCell span="col-span-4 md:col-span-8 lg:col-span-12" className="!py-0">
          <CoursesListing courses={mapped} />
        </LandingCell>
      </LandingSection>
    </>
  );
}

import Link from "next/link";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

export function LandingCta() {
  return (
    <LandingSection className="bg-swiss-red text-white">
      <LandingCell
        span="col-span-4 md:col-span-5 lg:col-span-7"
        className="!border-white/15"
      >
        <p className={`${landingLayout.label} !text-white/70`}>Ready to begin</p>
        <h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.03em] md:text-4xl lg:text-5xl">
          Your next career move starts here.
        </h2>
      </LandingCell>

      <LandingCell
        span="col-span-4 md:col-span-3 lg:col-span-5"
        className="flex flex-col justify-end !border-white/15"
      >
        <p className="max-w-sm text-sm leading-relaxed text-white/80">
          Join 500+ students building in-demand skills with live mentors, lifetime recordings, and
          placement support.
        </p>
        <div className="mt-8 flex flex-wrap gap-6">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            Enroll now <span className="text-white font-bold">→</span>
          </Link>
          <Link
            href="/courses"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-white"
          >
            Browse courses
          </Link>
        </div>
      </LandingCell>
    </LandingSection>
  );
}

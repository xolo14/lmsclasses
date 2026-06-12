import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function LandingCta() {
  return (
    <section className="bg-bg-base py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 rounded-2xl border border-bg-border bg-bg-card px-8 py-12 md:grid-cols-2 md:gap-16 md:px-14 md:py-16">
          <div>
            <h2 className="font-display text-3xl leading-snug text-text-primary md:text-4xl">
              Your next career move starts here
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-text-muted">
              Join {500}+ students building in-demand skills with live mentors, lifetime
              recordings, and dedicated placement support.
            </p>
          </div>

          <div className="md:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
              Ready to begin?
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/courses"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-brand-cyan sm:justify-end"
              >
                Browse our courses
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center rounded-lg bg-brand-cyan px-6 py-3 text-sm font-semibold text-bg-base transition-colors hover:bg-brand-cyan-light"
              >
                Enroll now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

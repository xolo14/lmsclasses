"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LandingCell, LandingSection, landingLayout } from "@/components/public/landing/landing-grid";

export function LandingHero() {
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => fetch("/api/system-settings").then((r) => r.json()),
  });

  const bootcampTitle = settings?.hero_card_title ?? "Full Stack Bootcamp";
  const studentCount = settings?.hero_card_student_count ?? "500+";

  return (
    <LandingSection className="bg-white">
      <LandingCell
        span="col-span-4 md:col-span-8 lg:col-span-12"
        className="relative min-h-[min(72vh,720px)] py-14 md:py-20 lg:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(10,10,10,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(10,10,10,0.07) 1px, transparent 1px)",
            backgroundSize: "calc(100% / 12) 100%, 100% 4rem",
          }}
        />

        <div className="relative grid h-full grid-cols-4 gap-x-6 md:grid-cols-8 lg:grid-cols-12 lg:gap-x-8">
          <div className="col-span-4 flex items-start justify-between gap-4 md:col-span-8 lg:col-span-12">
            <p className={landingLayout.label}>LMS Classes · India</p>
            <p className={`${landingLayout.label} text-right text-neutral-400`}>
              Live · Record · Placement
            </p>
          </div>

          <div className="col-span-4 mt-8 md:col-span-6 md:col-start-1 lg:col-span-8 lg:col-start-1 lg:mt-12">
            <h1 className="max-w-[14ch] text-[clamp(2.75rem,8vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.04em] text-neutral-950">
              Master skills the market demands.
            </h1>
          </div>

          <div className="col-span-4 mt-6 flex items-end md:col-span-2 md:col-start-7 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:row-span-2 lg:self-end">
            <div className="border-l-4 border-[#E30613] pl-5">
              <p className="text-sm font-medium leading-relaxed text-neutral-600 md:text-base">
                Live instruction, structured programs, and job-ready outcomes — one platform for
                serious learners.
              </p>
            </div>
          </div>

          <div className="col-span-4 mt-10 flex flex-col gap-6 border-t border-neutral-950/10 pt-8 md:col-span-8 lg:col-span-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Link
                href="#courses-section"
                className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-neutral-950"
              >
                Browse courses
                <span className="text-[#E30613] transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
            <p className="max-w-xs text-left text-xs leading-relaxed text-neutral-500 lg:text-right">
              New: <span className="font-medium text-neutral-800">{bootcampTitle}</span>
              <br />
              Trusted by {studentCount} students across India
            </p>
          </div>
        </div>
      </LandingCell>
    </LandingSection>
  );
}

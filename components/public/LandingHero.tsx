"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

const AVATAR_INITIALS = ["AK", "PS", "RM", "SJ"];

export function LandingHero() {
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => fetch("/api/system-settings").then((r) => r.json()),
  });

  const bootcampTitle = settings?.hero_card_title ?? "Full Stack Bootcamp";
  const studentCount = settings?.hero_card_student_count ?? "500+";

  return (
    <section className="relative overflow-hidden pb-4 pt-8 md:pb-6 md:pt-12 lg:pt-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,194,224,0.08),transparent)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-bg-border bg-bg-card/60 px-4 py-2 text-sm text-text-secondary backdrop-blur-sm">
            <span className="flex items-center gap-1.5 font-medium text-status-green">
              <span className="h-1.5 w-1.5 rounded-full bg-status-green" />
              Live
            </span>
            <span className="text-text-muted">·</span>
            <span>
              New: {bootcampTitle} —{" "}
              <Link href="/courses" className="text-brand-cyan hover:underline">
                Enroll Now
              </Link>
            </span>
          </div>

          <h1 className="font-display text-4xl leading-[1.15] tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-[4.25rem]">
            Master skills that the market{" "}
            <em className="italic text-text-primary">demands</em>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-muted md:text-lg">
            Live instruction from industry mentors, structured programs, and job-ready
            outcomes — all in one platform built for serious learners.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              className="h-12 rounded-lg bg-text-primary px-7 text-sm font-semibold text-bg-base hover:bg-text-secondary"
            >
              <a href="#courses-section">Browse courses</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-12 gap-2 rounded-lg border border-bg-border px-6 text-sm font-medium text-text-secondary hover:bg-bg-card hover:text-text-primary"
            >
              <Link href="/courses">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-bg-border bg-bg-card">
                  <Play className="h-3 w-3 fill-text-secondary text-text-secondary" />
                </span>
                Watch a free class
              </Link>
            </Button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-4">
            <div className="flex -space-x-2.5">
              {AVATAR_INITIALS.map((initials, i) => (
                <div
                  key={initials}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg-base bg-bg-card text-[10px] font-semibold text-text-secondary"
                  style={{ zIndex: AVATAR_INITIALS.length - i }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-text-muted">
              Trusted by{" "}
              <span className="font-medium text-text-secondary">{studentCount} students</span>{" "}
              across India
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

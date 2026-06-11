"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-brand-cyan/15 blur-3xl" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center gap-12 px-4 py-20 lg:flex-row lg:px-6">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 space-y-6 lg:max-w-[60%]"
        >
          <span className="inline-block rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            Trusted by 500+ students
          </span>
          <h1 className="text-4xl font-bold leading-tight text-text-primary md:text-5xl">
            Learn In-Demand Skills From Industry Experts
          </h1>
          <p className="max-w-xl text-lg text-text-secondary">
            Access 30+ professional training programs. Live classes, recorded sessions, and a
            built-in job portal — all in one platform.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild className="bg-brand-cyan text-bg-base hover:bg-brand-cyan-light">
              <a href="#courses-section">Explore Courses</a>
            </Button>
            <Button asChild variant="outline" className="border-bg-border text-text-primary">
              <Link href="/login">Login to Portal</Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 pt-4 text-sm text-text-muted">
            <span>30+ Courses</span>
            <span>Live Classes</span>
            <span>Job Portal</span>
            <span>Certificate</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative flex-1 lg:max-w-[40%]"
        >
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -right-4 -top-4 z-10 rounded-lg border border-bg-border bg-bg-card px-3 py-2 text-xs shadow-lg">
              <span className="text-brand-cyan">●</span> Live class starting soon
            </div>
            <div className="rotate-[-3deg] rounded-xl border border-bg-border bg-bg-card p-4 shadow-2xl">
              <div className="mb-3 aspect-video rounded-lg bg-gradient-to-br from-brand-cyan/30 to-bg-base" />
              <p className="font-semibold">Full Stack Bootcamp</p>
              <p className="text-sm text-text-muted">12 weeks · Live + Recorded</p>
              <div className="mt-3 rounded-lg bg-brand-cyan py-2 text-center text-sm font-medium text-bg-base">
                Join Live Class
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 rotate-[4deg] rounded-lg border border-bg-border bg-bg-card-hover px-4 py-3 shadow-xl">
              <p className="text-2xl font-bold text-brand-cyan">500+</p>
              <p className="text-xs text-text-muted">Active Students</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

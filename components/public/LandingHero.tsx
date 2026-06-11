"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, Users, Calendar } from "lucide-react";

export function LandingHero() {
  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => fetch("/api/system-settings").then((r) => r.json()),
  });

  const title = settings?.hero_card_title ?? "Full Stack Bootcamp";
  const subtitle = settings?.hero_card_subtitle ?? "12 weeks · Live + Recorded";
  const studentCount = settings?.hero_card_student_count ?? "500+";
  const studentLabel = settings?.hero_card_student_label ?? "Active Students";
  const liveBadge = settings?.hero_card_live_badge ?? "Live class starting soon";
  const btnText = settings?.hero_card_btn_text ?? "Join Live Class";

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden py-16 lg:py-24">
      {/* Decorative Grid and Glowing Orbs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#142848_1px,transparent_1px),linear-gradient(to_bottom,#142848_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />
      <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-brand-cyan/10 blur-[130px] pointer-events-none" />
      <div className="absolute left-[-10%] bottom-[-10%] h-[500px] w-[500px] rounded-full bg-blue-950/20 blur-[120px] pointer-events-none" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-16 px-4 lg:flex-row lg:px-6">
        {/* Left Side Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 space-y-8 lg:max-w-[55%]"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-cyan">
            <Users className="h-3.5 w-3.5" />
            <span>Trusted by {studentCount} Students</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-text-secondary to-brand-cyan md:text-5xl lg:text-6xl">
            Learn In-Demand Skills From Industry Experts
          </h1>

          <p className="max-w-xl text-lg text-text-muted leading-relaxed">
            Access 30+ professional training programs. Live classes, recorded sessions, and a
            built-in job portal — all in one unified, interactive platform.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button asChild className="bg-brand-cyan text-bg-base hover:bg-brand-cyan-light font-semibold shadow-lg shadow-brand-cyan/20 h-12 px-6 rounded-lg transition-all hover:-translate-y-0.5">
              <a href="#courses-section">Explore Courses</a>
            </Button>
            <Button asChild variant="outline" className="border-bg-border bg-white text-slate-950 hover:bg-slate-100 hover:text-slate-950 font-semibold h-12 px-6 rounded-lg shadow-sm transition-all hover:-translate-y-0.5">
              <Link href="/login">Login to Portal</Link>
            </Button>
          </div>

          {/* Badges/Tags list */}
          <div className="flex flex-wrap gap-3 pt-2">
            {["30+ Courses", "Live Classes", "Job Portal", "Certificate"].map((stat) => (
              <span
                key={stat}
                className="flex items-center gap-1.5 rounded-full border border-bg-border bg-bg-card/40 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-text-secondary shadow-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-pulse" />
                {stat}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right Side Card (Second Pic) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative flex-1 lg:max-w-[45%] w-full flex justify-center"
        >
          <div className="relative w-full max-w-sm">
            {/* Live badge */}
            <div className="absolute -right-3 -top-3 z-10 rounded-full border border-brand-cyan/30 bg-bg-card/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-text-primary shadow-xl shadow-black/40 flex items-center gap-2 animate-bounce">
              <span className="h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
              <span>{liveBadge}</span>
            </div>

            {/* Main Interactive Card */}
            <div className="rotate-[-3deg] hover:rotate-0 hover:scale-[1.03] transition-all duration-500 rounded-2xl border border-bg-border bg-bg-card/75 backdrop-blur-md p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              {/* Media area */}
              <div className="mb-4 aspect-video rounded-xl bg-gradient-to-br from-brand-cyan-dim/40 via-bg-card to-bg-base border border-bg-border/40 overflow-hidden relative flex items-center justify-center group/video cursor-pointer">
                <div className="absolute inset-0 bg-black/10 group-hover/video:bg-black/35 transition-colors duration-300" />
                <div className="h-14 w-14 rounded-full bg-brand-cyan/95 flex items-center justify-center text-bg-base shadow-lg group-hover/video:scale-110 transition-transform duration-300 z-10">
                  <Play className="h-6 w-6 fill-bg-base ml-1" />
                </div>
              </div>

              {/* Title & Info */}
              <h3 className="text-xl font-bold text-text-primary leading-snug">{title}</h3>
              <p className="text-sm text-text-muted mt-1 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-brand-cyan/80" />
                <span>{subtitle}</span>
              </p>

              {/* CTA button */}
              <div className="mt-5 w-full rounded-xl bg-brand-cyan py-3 text-center text-sm font-semibold text-bg-base hover:bg-brand-cyan-light hover:shadow-lg hover:shadow-brand-cyan/20 transition-all cursor-pointer">
                {btnText}
              </div>
            </div>

            {/* Stats badge (Bottom Left) */}
            <div className="absolute -bottom-6 -left-6 rotate-[4deg] hover:rotate-0 transition-transform duration-300 rounded-xl border border-bg-border bg-bg-card-hover/95 backdrop-blur-md px-5 py-3.5 shadow-2xl shadow-black/50">
              <p className="text-3xl font-black text-brand-cyan leading-none">{studentCount}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mt-1">{studentLabel}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

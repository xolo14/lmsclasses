"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { landingLayout } from "@/components/public/landing/landing-grid";

const navLinks = [
  { href: "/courses", label: "Courses" },
  { href: "/#how-it-works", label: "Process" },
  { href: "/#about", label: "About" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-950/10 bg-[#F4F4F0]/95 backdrop-blur-[2px]">
      <div className={landingLayout.frame}>
        <div
          className={cn(
            landingLayout.grid,
            "border-x",
            landingLayout.rule,
            "items-center"
          )}
        >
          <div className="col-span-2 flex h-14 items-center border-b border-neutral-950/10 px-4 md:col-span-3 lg:col-span-3 lg:h-16 lg:border-b-0 lg:px-8">
            <Link
              href="/"
              className="text-sm font-bold uppercase tracking-[0.22em] text-neutral-950"
            >
              LMS Classes
            </Link>
          </div>

          <nav className="col-span-2 hidden h-14 items-center justify-center gap-10 border-b border-neutral-950/10 md:col-span-3 md:flex lg:col-span-6 lg:h-16 lg:border-b-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-neutral-500 transition-colors hover:text-neutral-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="col-span-2 hidden h-14 items-center justify-end gap-6 border-b border-neutral-950/10 px-4 md:col-span-2 md:flex lg:col-span-3 lg:h-16 lg:border-b-0 lg:px-8">
            <Link
              href="/login"
              className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-950"
            >
              Login
            </Link>
            <Link
              href="/hr/login"
              className="border border-neutral-950 px-3 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
            >
              HR
            </Link>
          </div>

          <button
            type="button"
            className="col-span-2 flex h-14 items-center justify-end border-b border-neutral-950/10 px-4 text-neutral-950 md:col-span-8 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-b border-neutral-950/10 bg-white md:hidden">
          <div className={cn(landingLayout.frame, "border-x", landingLayout.rule)}>
            <nav className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-sm font-medium uppercase tracking-[0.16em] text-neutral-700"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium text-neutral-700"
              >
                Login
              </Link>
              <Link
                href="/hr/login"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-semibold text-neutral-950"
              >
                HR Login
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

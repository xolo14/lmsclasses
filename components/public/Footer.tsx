import Link from "next/link";
import { landingLayout } from "@/components/public/landing/landing-grid";
import { cn } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-swiss-black/10 bg-swiss-cream">
      <div className={landingLayout.frame}>
        <div className={cn(landingLayout.grid, "border-x", landingLayout.rule)}>
          <div className="col-span-4 border-b border-neutral-950/10 px-4 py-10 md:col-span-4 lg:col-span-4 lg:border-b-0 lg:px-8">
            <Link
              href="/"
              className="text-sm font-bold uppercase tracking-[0.22em] text-neutral-950"
            >
              LMS Classes
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-neutral-500">
              Clarity, order, and function — learning designed for outcomes.
            </p>
          </div>

          <nav className="col-span-4 flex flex-col gap-3 border-b border-neutral-950/10 px-4 py-10 md:col-span-4 lg:col-span-4 lg:border-b-0 lg:px-8">
            <Link href="/courses" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-950">
              Courses
            </Link>
            <Link href="/login" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-950">
              Login
            </Link>
            <Link href="/privacy" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-950">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-600 hover:text-neutral-950">
              Terms
            </Link>
          </nav>

          <div className="col-span-4 px-4 py-10 md:col-span-8 lg:col-span-4 lg:px-8">
            <p className={landingLayout.label}>Contact</p>
            <a
              href="mailto:info@lmsclasses.com"
              className="mt-3 block text-sm font-medium text-neutral-950 hover:text-swiss-red"
            >
              info@lmsclasses.com
            </a>
            <p className="mt-8 text-[0.6875rem] uppercase tracking-[0.2em] text-neutral-400">
              © {new Date().getFullYear()} LMS Classes
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

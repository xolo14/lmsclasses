import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-bg-border bg-bg-base">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 py-12 sm:flex-row sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-lg text-text-primary">
          LMS Classes
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-text-muted">
          <Link href="/courses" className="transition-colors hover:text-text-primary">
            Courses
          </Link>
          <Link href="/login" className="transition-colors hover:text-text-primary">
            Login
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-text-primary">
            Privacy policy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-text-primary">
            Terms of service
          </Link>
        </nav>

        <a
          href="mailto:info@lmsclasses.com"
          className="text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          info@lmsclasses.com
        </a>
      </div>

      <div className="border-t border-bg-border py-5 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} LMS Classes · All rights reserved
      </div>
    </footer>
  );
}

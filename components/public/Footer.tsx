import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-bg-border bg-bg-base">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-bold text-brand-cyan">LMSClasses.com</p>
          <p className="mt-2 text-sm text-text-muted">
            Professional training with live classes, recordings, and career support.
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-text-primary">Quick Links</p>
          <ul className="space-y-2 text-sm text-text-muted">
            <li>
              <Link href="/courses" className="hover:text-brand-cyan">
                Courses
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-brand-cyan">
                Login
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-brand-cyan">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-cyan">
                Terms
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-text-primary">Contact</p>
          <p className="text-sm text-text-muted">info@lmsclasses.com</p>
        </div>
      </div>
      <div className="border-t border-bg-border py-4 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} LMSClasses.com · Built on LMSClasses Platform
      </div>
    </footer>
  );
}

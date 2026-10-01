import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | LMS Classes",
  description: "Terms for using the LMS Classes website and learning portal.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 1 October 2026</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-neutral-700">
        <p>
          These terms apply to{" "}
          <a className="underline" href="https://lmsclasses.com">
            https://lmsclasses.com
          </a>{" "}
          and the LMS Classes portal. Contact:{" "}
          <a className="underline" href="mailto:info@lmsclasses.com">
            info@lmsclasses.com
          </a>
          .
        </p>
        <p>
          You must provide accurate account details and keep your login private. Students, mentors, and staff may only
          use content and live classes they are enrolled in or assigned to.
        </p>
        <p>
          Course fees, refunds, and batch policies are as stated at checkout or in your organisation agreement. Payments
          are processed by Razorpay.
        </p>
        <p>
          Connecting Google Calendar is optional. You authorise LMS Classes to create or update calendar events and Meet
          links for live classes. You can disconnect at any time.
        </p>
        <p>
          We may suspend access for abuse, unpaid fees, or legal risk. Course materials remain the property of LMS
          Classes or the stated rights holder.
        </p>
        <p>
          See our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

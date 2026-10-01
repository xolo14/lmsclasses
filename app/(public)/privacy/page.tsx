import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | LMS Classes",
  description: "How LMS Classes collects, uses, and protects personal data, including Google Calendar access.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: 1 October 2026</p>
      <p className="mt-6 text-sm leading-relaxed text-neutral-700">
        LMS Classes (&quot;we&quot;, &quot;us&quot;) operates{" "}
        <a className="underline" href="https://lmsclasses.com">
          https://lmsclasses.com
        </a>
        . This policy explains what we collect when you use the website, student/staff portal, payments, and Google
        Calendar / Meet features.
      </p>

      <section className="mt-10 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">1. Who we are</h2>
        <p>
          Contact:{" "}
          <a className="underline" href="mailto:info@lmsclasses.com">
            info@lmsclasses.com
          </a>
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">2. Information we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account details: name, email, role (student, mentor, manager, admin), organisation, and login records.</li>
          <li>Enrollment and payment data: course, batch, amounts, Razorpay payment identifiers (we do not store full card numbers).</li>
          <li>Learning activity: live-class attendance, recordings you watch, certificates, and job applications you submit.</li>
          <li>Support messages you send to us.</li>
          <li>
            Google Calendar data only if you click <strong>Connect Google Calendar</strong>: your Google account email
            and permission to create or update calendar events and Meet links for LMS live classes. We store encrypted
            access and refresh tokens. We do not read your personal email, Drive, photos, or unrelated calendars.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">3. How we use it</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>To run your LMS account, classes, recordings, and certificates.</li>
          <li>To process enrollments and send receipts, class reminders, and Meet join links.</li>
          <li>
            If you connect Google: to put live-class events on your calendar and, for hosts, to create Google Meet links
            using the platform or mentor calendar.
          </li>
          <li>To keep the service secure (authentication, audit logs, abuse prevention).</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">4. Google user data</h2>
        <p>
          Google Calendar access is optional. You can disconnect anytime from Settings → Integrations. After disconnect
          we revoke the token with Google and delete the stored tokens. We use Google data only to provide calendar and
          Meet features for LMS Classes. We do not sell Google user data or use it for advertising.
        </p>
        <p>
          Scope requested: <code className="text-xs">https://www.googleapis.com/auth/calendar.events</code> (and email /
          openid to identify the connected account).
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">5. Sharing</h2>
        <p>We share data only with processors needed to run the product:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Hosting and database providers.</li>
          <li>Razorpay for payments.</li>
          <li>Google, if you connect Calendar / Meet.</li>
          <li>Email delivery (transactional class and account emails).</li>
          <li>When required by law.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">6. Cookies</h2>
        <p>
          We use essential cookies for sign-in and security. We do not use those cookies to sell your data. Analytics
          tags on public pages, if enabled, measure site usage.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">7. Retention and your rights</h2>
        <p>
          We keep account and class records while your organisation uses LMS Classes, and as required for payments or
          legal records. You may request access, correction, or deletion of your account data by emailing{" "}
          <a className="underline" href="mailto:info@lmsclasses.com">
            info@lmsclasses.com
          </a>
          . You can disconnect Google without deleting your LMS account.
        </p>
      </section>

      <section className="mt-8 space-y-3 text-sm leading-relaxed text-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-950">8. Contact</h2>
        <p>
          LMS Classes ·{" "}
          <a className="underline" href="mailto:info@lmsclasses.com">
            info@lmsclasses.com
          </a>
        </p>
        <p>
          Also see our{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

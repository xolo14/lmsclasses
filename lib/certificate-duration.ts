/** Parse course duration text (e.g. "12 weeks", "3 months") into milliseconds. */
export function parseCourseDurationMs(duration: string | null | undefined): number | null {
  if (!duration?.trim()) return null;
  const match = duration.trim().toLowerCase().match(
    /(\d+(?:\.\d+)?)\s*(week|weeks|wk|w|month|months|mo|day|days|d|hour|hours|hr|h|year|years|yr|y)\b/
  );
  if (!match) {
    const numOnly = duration.trim().match(/^(\d+(?:\.\d+)?)$/);
    if (numOnly) return Number(numOnly[1]) * 7 * 24 * 60 * 60 * 1000;
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2]!;
  const day = 24 * 60 * 60 * 1000;

  if (unit.startsWith("w")) return amount * 7 * day;
  if (unit.startsWith("mo") || (unit === "m" && amount <= 24)) return amount * 30 * day;
  if (unit.startsWith("d")) return amount * day;
  if (unit.startsWith("h")) return amount * 60 * 60 * 1000;
  if (unit.startsWith("y")) return amount * 365 * day;
  return null;
}

/** Product timezone for “issue on the day of …” (IST). */
export const CERT_CALENDAR_TZ = "Asia/Kolkata";

/** Calendar day key YYYY-MM-DD in the product timezone. */
export function toDateKey(d: Date, timeZone = CERT_CALENDAR_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** @deprecated use toDateKey — kept for callers that meant UTC */
export function toUtcDateKey(d: Date): string {
  return toDateKey(d, "UTC");
}

export function getEnrollmentStartDate(enrolledAt: Date | null | undefined): Date | null {
  if (!enrolledAt) return null;
  return new Date(enrolledAt);
}

export function getDurationEligibleAt(
  enrolledAt: Date | null | undefined,
  duration: string | null | undefined
): Date | null {
  const start = getEnrollmentStartDate(enrolledAt);
  if (!start) return null;
  const ms = parseCourseDurationMs(duration);
  if (ms === null) return null;
  return new Date(start.getTime() + ms);
}

export type CertificateEligibilityInput = {
  courseType: "live" | "record";
  enrolledAt: Date | null | undefined;
  courseDuration: string | null | undefined;
  /** Set when live enrollment has a batch assigned. */
  hasBatch?: boolean;
  /** batch.endDate — required for live+batch auto-issue. */
  batchEndDate?: Date | null;
};

/**
 * Recorded / live without batch: enrolledAt + course duration.
 * Live with batch: batch end date only (no duration fallback).
 */
export function getCertificateEligibleAt(input: CertificateEligibilityInput): Date | null {
  if (input.courseType === "live" && input.hasBatch) {
    if (!input.batchEndDate) return null; // batch assigned but no end date → wait
    return new Date(input.batchEndDate);
  }
  return getDurationEligibleAt(input.enrolledAt, input.courseDuration);
}

export function isCertificateAutoEligible(
  input: CertificateEligibilityInput,
  now = new Date()
): boolean {
  const eligibleAt = getCertificateEligibleAt(input);
  if (!eligibleAt) return false;
  // Instant comparison — do not issue before the full duration / batch end elapses
  return now.getTime() >= eligibleAt.getTime();
}

/** Issue timestamp = completion-day instant (not cron run time). */
export function getCertificateAutoIssueTimestamp(
  input: CertificateEligibilityInput,
  now = new Date()
): Date | null {
  const eligibleAt = getCertificateEligibleAt(input);
  if (!eligibleAt) return null;
  if (now.getTime() < eligibleAt.getTime()) return null;
  return eligibleAt;
}

/** @deprecated use isCertificateAutoEligible */
export function isEnrollmentDurationComplete(
  enrolledAt: Date | null | undefined,
  duration: string | null | undefined,
  now = new Date()
): boolean {
  return isCertificateAutoEligible(
    { courseType: "record", enrolledAt, courseDuration: duration },
    now
  );
}

/** @deprecated use getCertificateAutoIssueTimestamp */
export function getAutoIssueTimestamp(
  enrolledAt: Date | null | undefined,
  duration: string | null | undefined,
  now = new Date()
): Date | null {
  return getCertificateAutoIssueTimestamp(
    { courseType: "record", enrolledAt, courseDuration: duration },
    now
  );
}

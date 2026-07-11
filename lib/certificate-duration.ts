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

export function getEnrollmentStartDate(enrolledAt: Date | null | undefined): Date {
  return enrolledAt ? new Date(enrolledAt) : new Date();
}

/** True when enrolledAt + course duration has passed. False if duration is missing/unparseable. */
export function isEnrollmentDurationComplete(
  enrolledAt: Date | null | undefined,
  duration: string | null | undefined,
  now = new Date()
): boolean {
  const ms = parseCourseDurationMs(duration);
  if (ms === null) return false;
  const start = getEnrollmentStartDate(enrolledAt);
  return now.getTime() >= start.getTime() + ms;
}

export function getDurationEligibleAt(
  enrolledAt: Date | null | undefined,
  duration: string | null | undefined
): Date | null {
  const ms = parseCourseDurationMs(duration);
  if (ms === null) return null;
  return new Date(getEnrollmentStartDate(enrolledAt).getTime() + ms);
}

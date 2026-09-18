import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

/** Platform timezone for every displayed clock (Indian Standard Time). */
export const IST_TIMEZONE = "Asia/Kolkata";

function asDate(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(date: Date | string | null | undefined): string {
  const d = asDate(date);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format an instant as IST wall-clock for HTML datetime-local inputs. */
export function toDatetimeLocalValue(date: Date | string | null | undefined): string {
  const d = asDate(date);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Treat a datetime-local string as IST (UTC+05:30). ISO strings with a zone are kept as-is. */
export function parseDatetimeLocalAsIst(value: string): Date {
  const trimmed = value.trim();
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(trimmed);
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+05:30`);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  const d = asDate(date);
  if (!d) return "—";
  const formatted = d.toLocaleString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${formatted} IST`;
}

export const ROLE_ROUTES: Record<string, string> = {
  super_admin: "/super-admin",
  org_admin: "/org-admin",
  manager: "/manager",
  mentor: "/mentor",
  student: "/student",
  hr: "/hr",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Organisation Admin",
  manager: "Manager",
  mentor: "Mentor",
  student: "Student",
  hr: "HR",
};

/** Turn API `{ error: string | Zod flatten }` into a user-visible message. */
export async function parseApiJson<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.slice(0, 300) || res.statusText || "Invalid server response"
    );
  }
}

export function formatApiError(error: unknown, fallback = "Something went wrong"): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const e = error as {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
    };
    const parts = [...(e.formErrors ?? [])];
    if (e.fieldErrors) {
      for (const msgs of Object.values(e.fieldErrors)) {
        parts.push(...msgs);
      }
    }
    if (parts.length) return parts.join(". ");
  }
  return fallback;
}

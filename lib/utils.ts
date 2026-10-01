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

/** IST wall-clock as `YYYY-MM-DDTHH:mm:ss` (no offset) — for calendar UIs rendered in a fixed zone. */
export function toIstWallClock(date: Date | string | null | undefined): string {
  const d = asDate(date);
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
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

/** Portal landing for a signed-in role. Never returns /login (that caused redirect loops). */
export function portalHomeForRole(role: string | undefined | null): string {
  if (role === "mentor") return "/mentor/dashboard";
  if (role === "student") return "/student/courses";
  if (role === "hr") return "/hr/dashboard";
  if (role && ROLE_ROUTES[role]) return `${ROLE_ROUTES[role]}/dashboard`;
  return "/";
}

/** Roles that may create/schedule a live class. */
export const LIVE_CLASS_CREATE_ROLES = ["super_admin", "manager", "mentor"] as const;

/** Roles that may host (own the Google Calendar event of) a live class. */
export const GOOGLE_HOST_ROLES = ["mentor", "manager", "org_admin", "super_admin"] as const;

/** Roles that may connect their own Google Calendar (every LMS portal user except HR). */
export const GOOGLE_CALENDAR_ROLES = ["student", "mentor", "manager", "org_admin", "super_admin"] as const;

export function canCreateLiveClass(role: string | undefined | null): boolean {
  return !!role && (LIVE_CLASS_CREATE_ROLES as readonly string[]).includes(role);
}

export function canHostLiveClass(role: string | undefined | null): boolean {
  return !!role && (GOOGLE_HOST_ROLES as readonly string[]).includes(role);
}

export function canConnectGoogleCalendar(role: string | undefined | null): boolean {
  return !!role && (GOOGLE_CALENDAR_ROLES as readonly string[]).includes(role);
}

export function isPortalHomePath(pathname: string | null | undefined, role: string | undefined | null): boolean {
  if (!pathname || !role) return false;
  if (role === "student") return pathname === "/student/courses" || pathname === "/student/calendar";
  const base = ROLE_ROUTES[role];
  return !!base && pathname === `${base}/dashboard`;
}

/** Settings → Integrations page for a role (where the Google connect card lives). */
export function integrationsPathForRole(role: string | undefined | null): string {
  if (role && ROLE_ROUTES[role]) return `${ROLE_ROUTES[role]}/settings/integrations`;
  return "/login";
}

/** Calendar page for a role. */
export function calendarPathForRole(role: string | undefined | null): string {
  if (role && ROLE_ROUTES[role]) return `${ROLE_ROUTES[role]}/calendar`;
  return "/login";
}

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

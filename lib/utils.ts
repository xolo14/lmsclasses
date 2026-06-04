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

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

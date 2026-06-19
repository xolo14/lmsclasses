import type { ApiKey } from "@/lib/db/schema";
import { DEFAULT_LEAD_FIELDS } from "@/lib/api-key-types";

const FIELD_ALIASES: Record<string, string> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
  referral_code: "referralCode",
  landing_page_url: "landingPageUrl",
  working_status: "workingStatus",
  preferred_batch_time: "preferredBatchTime",
};

export function normalizeLeadBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const [snake, camel] of Object.entries(FIELD_ALIASES)) {
    if (out[snake] !== undefined && out[camel] === undefined) {
      out[camel] = out[snake];
    }
  }
  return out;
}

export function validateIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(normalized);
}

export function validateLeadFields(
  apiKey: ApiKey,
  body: Record<string, unknown>
): { ok: true; data: Record<string, unknown> } | { ok: false; fields: Record<string, string> } {
  const config = (apiKey.leadFields as { required?: string[]; optional?: string[] }) ?? DEFAULT_LEAD_FIELDS;
  const required = config.required ?? DEFAULT_LEAD_FIELDS.required;
  const optional = config.optional ?? DEFAULT_LEAD_FIELDS.optional;
  const allowed = new Set([...required, ...optional]);
  const fields: Record<string, string> = {};

  for (const field of required) {
    const val = body[field];
    if (val === undefined || val === null || String(val).trim() === "") {
      fields[field] = `${field} is required`;
    }
  }

  if (body.email && typeof body.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    fields.email = "Valid email is required";
  }

  if (body.phone && typeof body.phone === "string" && !validateIndianPhone(body.phone)) {
    fields.phone = "Must be a valid 10-digit Indian mobile number";
  }

  for (const key of Object.keys(body)) {
    if (!allowed.has(key) && !["source"].includes(key)) {
      // ignore unknown fields silently
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, data: body };
}

export const UPDATABLE_LEAD_FIELDS = [
  "city",
  "qualification",
  "workingStatus",
  "preferredBatchTime",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referralCode",
  "landingPageUrl",
] as const;

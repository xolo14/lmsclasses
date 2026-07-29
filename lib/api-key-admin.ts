import type { ApiKey } from "@/lib/db/schema";
import type { SQL } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, recordCourses } from "@/lib/db/schema";
import { maskFromPrefix, resolveAllowedCourseIds } from "@/lib/api-key-service";
import { isRecordingsApiKey } from "@/lib/api-key-types";
import { buildFormLink } from "@/lib/widget/form-slug";

export function resolveApiKeyCourseId(k: ApiKey): string | null {
  return k.courseId ?? (k.allowedCourses?.length === 1 ? k.allowedCourses[0] : null) ?? null;
}

/** Columns excluding form_slug — used to read api keys before the migration adds that column. */
const apiKeyColumnsWithoutFormSlug = {
  id: apiKeys.id,
  name: apiKeys.name,
  keyPrefix: apiKeys.keyPrefix,
  keyHash: apiKeys.keyHash,
  permissions: apiKeys.permissions,
  courseId: apiKeys.courseId,
  allowedCourses: apiKeys.allowedCourses,
  allowedPaymentGateway: apiKeys.allowedPaymentGateway,
  webhookUrl: apiKeys.webhookUrl,
  webhookSecret: apiKeys.webhookSecret,
  leadFields: apiKeys.leadFields,
  autoCreateStudent: apiKeys.autoCreateStudent,
  sendWelcomeEmail: apiKeys.sendWelcomeEmail,
  notifyWebhook: apiKeys.notifyWebhook,
  rateLimit: apiKeys.rateLimit,
  ipWhitelist: apiKeys.ipWhitelist,
  environment: apiKeys.environment,
  isActive: apiKeys.isActive,
  createdBy: apiKeys.createdBy,
  lastUsedAt: apiKeys.lastUsedAt,
  usageCount: apiKeys.usageCount,
  notes: apiKeys.notes,
  widgetDomainsAllowed: apiKeys.widgetDomainsAllowed,
  redirectOnSuccess: apiKeys.redirectOnSuccess,
  redirectOnFailure: apiKeys.redirectOnFailure,
  expiresAt: apiKeys.expiresAt,
  createdAt: apiKeys.createdAt,
  updatedAt: apiKeys.updatedAt,
} as const;

function isMissingFormSlugError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /form_slug/i.test(message) && /(does not exist|unknown column|column)/i.test(message);
}

function isMissingColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /(does not exist|unknown column)/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

export type ApiKeyInsertInput = {
  name: string;
  keyPrefix: string;
  keyHash: string;
  permissions: string[];
  courseId?: string | null;
  allowedCourses: string[];
  allowedPaymentGateway: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  leadFields: ApiKey["leadFields"];
  autoCreateStudent: boolean;
  sendWelcomeEmail: boolean;
  notifyWebhook: boolean;
  rateLimit: ApiKey["rateLimit"];
  ipWhitelist: string[];
  widgetDomainsAllowed: string[];
  redirectOnSuccess: string;
  redirectOnFailure: string | null;
  expiresAt: Date | null;
  environment: string;
  isActive: boolean;
  createdBy: string;
  notes: string | null;
};

/**
 * Inserts an API key, retrying with fewer columns when the DB is missing newer
 * migrations (form_slug, course_id, etc.). Always RETURNING without form_slug.
 */
export async function insertApiKeySafe(
  values: ApiKeyInsertInput,
  formSlug: string | null
): Promise<ApiKey> {
  const base = { ...values };
  const payloads: Record<string, unknown>[] = [];

  if (formSlug) payloads.push({ ...base, formSlug });
  payloads.push(base);

  if (values.courseId) {
    const { courseId: _omit, ...withoutCourseId } = base;
    if (formSlug) payloads.push({ ...withoutCourseId, formSlug });
    payloads.push(withoutCourseId);
  }

  const seen = new Set<string>();
  const attempts = payloads.filter((p) => {
    const key = JSON.stringify(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let lastErr: unknown;
  for (const payload of attempts) {
    try {
      const [row] = await db
        .insert(apiKeys)
        .values(payload as typeof apiKeys.$inferInsert)
        .returning(apiKeyColumnsWithoutFormSlug);
      const slug = typeof payload.formSlug === "string" ? payload.formSlug : null;
      return { ...row, formSlug: slug } as ApiKey;
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      lastErr = err;
    }
  }

  throw lastErr ?? new Error("Failed to insert API key");
}

/**
 * Reads api keys, tolerating a database where the form_slug column has not been
 * created yet (migration pending). Falls back to a column list without form_slug.
 */
export async function selectApiKeysSafe(where?: SQL, orderBy?: SQL): Promise<ApiKey[]> {
  try {
    const base = db.select().from(apiKeys);
    const filtered = where ? base.where(where) : base;
    return await (orderBy ? filtered.orderBy(orderBy) : filtered);
  } catch (err) {
    if (!isMissingFormSlugError(err)) throw err;
    const base = db.select(apiKeyColumnsWithoutFormSlug).from(apiKeys);
    const filtered = where ? base.where(where) : base;
    const rows = await (orderBy ? filtered.orderBy(orderBy) : filtered);
    return rows.map((r) => ({ ...r, formSlug: null }) as ApiKey);
  }
}

export async function fetchApiKeyCourseMeta(courseId: string | null): Promise<{
  courseTitle: string | null;
  coursePrice: number | null;
}> {
  if (!courseId) return { courseTitle: null, coursePrice: null };

  const [course] = await db
    .select({ title: recordCourses.title, price: recordCourses.price })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);

  if (!course) return { courseTitle: null, coursePrice: null };
  return { courseTitle: course.title, coursePrice: parseFloat(course.price) };
}

export async function serializeApiKeyWithCourse(
  k: ApiKey,
  options?: { includeSecrets?: boolean }
) {
  const allowedIds = resolveAllowedCourseIds(k);
  if (allowedIds.length === 0) {
    return serializeApiKey(k, options);
  }

  if (allowedIds.length === 1) {
    const meta = await fetchApiKeyCourseMeta(allowedIds[0]!);
    return serializeApiKey(k, {
      ...options,
      ...meta,
      courseTitles: meta.courseTitle ? [meta.courseTitle] : [],
    });
  }

  const rows = await db
    .select({ id: recordCourses.id, title: recordCourses.title })
    .from(recordCourses)
    .where(inArray(recordCourses.id, allowedIds));
  const titleById = new Map(rows.map((r) => [r.id, r.title]));
  const courseTitles = allowedIds
    .map((id) => titleById.get(id))
    .filter(Boolean) as string[];

  return serializeApiKey(k, {
    ...options,
    courseTitle: `${courseTitles.length} courses`,
    coursePrice: null,
    courseTitles,
  });
}

export function serializeApiKey(
  k: ApiKey,
  options?: {
    includeSecrets?: boolean;
    courseTitle?: string | null;
    coursePrice?: number | null;
    courseTitles?: string[];
  }
) {
  const includeSecrets = options?.includeSecrets ?? false;
  const courseId = resolveApiKeyCourseId(k);
  const allowedCourses = resolveAllowedCourseIds(k);
  const recordingsKey = isRecordingsApiKey(k);
  return {
    id: k.id,
    name: k.name,
    maskedKey: maskFromPrefix(k.keyPrefix, k.environment ?? "live"),
    keyPrefix: k.keyPrefix,
    courseId,
    courseTitle: options?.courseTitle ?? null,
    coursePrice: options?.coursePrice ?? null,
    courseTitles: options?.courseTitles ?? [],
    keyType: recordingsKey ? ("recordings" as const) : ("widget" as const),
    permissions: k.permissions ?? [],
    allowedCourses,
    allowedPaymentGateway: k.allowedPaymentGateway,
    webhookUrl: k.webhookUrl,
    webhookSecret: includeSecrets ? k.webhookSecret : k.webhookSecret ? "••••••••" : null,
    leadFields: k.leadFields,
    autoCreateStudent: k.autoCreateStudent,
    sendWelcomeEmail: k.sendWelcomeEmail,
    notifyWebhook: k.notifyWebhook,
    rateLimit: k.rateLimit,
    ipWhitelist: k.ipWhitelist ?? [],
    environment: k.environment,
    isActive: k.isActive,
    widgetDomainsAllowed: recordingsKey ? [] : (k.widgetDomainsAllowed ?? []),
    redirectOnSuccess: k.redirectOnSuccess ?? "/login",
    redirectOnFailure: k.redirectOnFailure ?? null,
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount,
    notes: k.notes,
    // Recordings keys never expose hosted form / embed enrollment links
    formSlug: recordingsKey ? null : (k.formSlug ?? null),
    formLink: recordingsKey || !k.formSlug ? null : buildFormLink(k.formSlug),
    recordingsEndpoint: recordingsKey ? "/api/external/recordings" : null,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}

import type { ApiKey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recordCourses } from "@/lib/db/schema";
import { maskFromPrefix } from "@/lib/api-key-service";
import { buildFormLink } from "@/lib/widget/form-slug";

export function resolveApiKeyCourseId(k: ApiKey): string | null {
  return k.courseId ?? (k.allowedCourses?.length === 1 ? k.allowedCourses[0] : null) ?? null;
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
  const courseId = resolveApiKeyCourseId(k);
  const meta = await fetchApiKeyCourseMeta(courseId);
  return serializeApiKey(k, { ...options, ...meta });
}

export function serializeApiKey(
  k: ApiKey,
  options?: { includeSecrets?: boolean; courseTitle?: string | null; coursePrice?: number | null }
) {
  const includeSecrets = options?.includeSecrets ?? false;
  const courseId = resolveApiKeyCourseId(k);
  return {
    id: k.id,
    name: k.name,
    maskedKey: maskFromPrefix(k.keyPrefix, k.environment ?? "live"),
    keyPrefix: k.keyPrefix,
    courseId,
    courseTitle: options?.courseTitle ?? null,
    coursePrice: options?.coursePrice ?? null,
    permissions: k.permissions ?? [],
    allowedCourses: courseId ? [courseId] : (k.allowedCourses ?? []),
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
    widgetDomainsAllowed: k.widgetDomainsAllowed ?? [],
    redirectOnSuccess: k.redirectOnSuccess ?? "/login",
    redirectOnFailure: k.redirectOnFailure ?? null,
    expiresAt: k.expiresAt,
    lastUsedAt: k.lastUsedAt,
    usageCount: k.usageCount,
    notes: k.notes,
    formSlug: k.formSlug ?? null,
    formLink: k.formSlug ? buildFormLink(k.formSlug) : null,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { apiKeys, recordCourses } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import {
  generatePlainApiKey,
  hashApiKey,
  extractDisplayPrefix,
} from "@/lib/api-key-service";
import { buildEmbedSnippet } from "@/lib/widget/build-embed-snippet";
import { getApiKeyStats, getApiKeyListSummaries } from "@/lib/widget/widget-stats";
import { serializeApiKey } from "@/lib/api-key-admin";

async function getSuperAdminActor() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "super_admin") return null;
  const h = await headers();
  return {
    userId: session.user.id,
    ipAddress:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      undefined,
  };
}

export async function listApiKeysAction(filters?: {
  search?: string;
  isActive?: boolean;
}) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");

  const rows = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  const filtered = rows.filter((k) => {
    if (filters?.isActive !== undefined && k.isActive !== filters.isActive) return false;
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      if (!k.name.toLowerCase().includes(q) && !(k.notes ?? "").toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const summaries = await getApiKeyListSummaries(filtered.map((k) => k.id));
  const courseIds = [...new Set(filtered.map((k) => k.courseId).filter(Boolean) as string[])];
  const allCourses =
    courseIds.length > 0
      ? await db
          .select({ id: recordCourses.id, title: recordCourses.title, price: recordCourses.price })
          .from(recordCourses)
          .where(inArray(recordCourses.id, courseIds))
      : [];
  const courseMap = new Map(allCourses.map((c) => [c.id, c]));

  return filtered.map((k) => {
    const course = k.courseId ? courseMap.get(k.courseId) : null;
    const stats = summaries.get(k.id);
    return {
      ...serializeApiKey(k, {
        courseTitle: course?.title ?? null,
        coursePrice: course ? parseFloat(course.price) : null,
      }),
      totalLeads: stats?.totalLeads ?? 0,
      totalConversions: stats?.totalConversions ?? 0,
      conversionRate: stats?.conversionRate ?? 0,
      totalRevenue: stats?.totalRevenue ?? 0,
    };
  });
}

export async function getApiKeyStatsAction(keyId: string) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");
  const stats = await getApiKeyStats(keyId);
  if (!stats) throw new Error("API key not found");
  return stats;
}

export async function toggleApiKeyAction(keyId: string, isActive: boolean) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");

  await db
    .update(apiKeys)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(apiKeys.id, keyId));

  await logAction({
    userId: actor.userId,
    role: "super_admin",
    action: isActive ? "API_KEY_ENABLED" : "API_KEY_DISABLED",
    entity: "ApiKey",
    entityId: keyId,
    ipAddress: actor.ipAddress,
  });

  revalidatePath("/super-admin/api-keys");
  revalidatePath(`/super-admin/api-keys/${keyId}`);
}

export async function revokeApiKeyAction(keyId: string) {
  return toggleApiKeyAction(keyId, false);
}

export async function rotateApiKeyAction(keyId: string) {
  const actor = await getSuperAdminActor();
  if (!actor) throw new Error("Unauthorized");

  const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId)).limit(1);
  if (!existing) throw new Error("API key not found");

  const plainKey = generatePlainApiKey((existing.environment as "live" | "test") ?? "live");
  await db
    .update(apiKeys)
    .set({
      keyHash: hashApiKey(plainKey),
      keyPrefix: extractDisplayPrefix(plainKey),
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId));

  await logAction({
    userId: actor.userId,
    role: "super_admin",
    action: "API_KEY_ROTATED",
    entity: "ApiKey",
    entityId: keyId,
    ipAddress: actor.ipAddress,
  });

  revalidatePath("/super-admin/api-keys");
  revalidatePath(`/super-admin/api-keys/${keyId}`);

  return {
    plainKey,
    embedSnippet: buildEmbedSnippet(plainKey),
  };
}

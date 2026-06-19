import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, recordCourses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { createApiKeySchema } from "@/lib/validations/api-key";
import {
  generatePlainApiKey,
  hashApiKey,
  extractDisplayPrefix,
} from "@/lib/api-key-service";
import { DEFAULT_LEAD_FIELDS, DEFAULT_RATE_LIMIT } from "@/lib/api-key-types";
import { serializeApiKey } from "@/lib/api-key-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get("isActive");
    const environment = searchParams.get("environment");
    const search = searchParams.get("search");

    const conditions = [];
    if (isActive === "true") conditions.push(eq(apiKeys.isActive, true));
    if (isActive === "false") conditions.push(eq(apiKeys.isActive, false));
    if (environment) conditions.push(eq(apiKeys.environment, environment));
    if (search) {
      conditions.push(
        or(ilike(apiKeys.name, `%${search}%`), ilike(apiKeys.notes, `%${search}%`))!
      );
    }

    const list = await db
      .select()
      .from(apiKeys)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(apiKeys.createdAt));

    const courseIds = [
      ...new Set(
        list
          .map((k) => k.courseId ?? (k.allowedCourses?.length === 1 ? k.allowedCourses[0] : null))
          .filter(Boolean) as string[]
      ),
    ];
    const courseRows =
      courseIds.length > 0
        ? await db
            .select({ id: recordCourses.id, title: recordCourses.title })
            .from(recordCourses)
            .where(inArray(recordCourses.id, courseIds))
        : [];
    const courseTitleById = new Map(courseRows.map((c) => [c.id, c.title]));

    return NextResponse.json(
      list.map((k) => {
        const courseId = k.courseId ?? (k.allowedCourses?.length === 1 ? k.allowedCourses[0] : null);
        return serializeApiKey(k, {
          courseTitle: courseId ? (courseTitleById.get(courseId) ?? null) : null,
        });
      })
    );
  } catch (err) {
    console.error("[api/super-admin/api-keys] GET:", err);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const [course] = await db
      .select({ id: recordCourses.id, title: recordCourses.title })
      .from(recordCourses)
      .where(eq(recordCourses.id, data.courseId))
      .limit(1);
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 400 });
    }

    const plainKey = generatePlainApiKey(data.environment);
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = extractDisplayPrefix(plainKey);

    const [row] = await db
      .insert(apiKeys)
      .values({
        name: data.name,
        keyPrefix,
        keyHash,
        permissions: data.permissions,
        courseId: data.courseId,
        allowedCourses: [data.courseId],
        allowedPaymentGateway: data.allowedPaymentGateway ?? "any",
        webhookUrl: data.webhookUrl ?? null,
        webhookSecret: data.webhookSecret ?? null,
        leadFields: data.leadFields ?? DEFAULT_LEAD_FIELDS,
        autoCreateStudent: data.autoCreateStudent ?? true,
        sendWelcomeEmail: data.sendWelcomeEmail ?? true,
        notifyWebhook: data.notifyWebhook ?? false,
        rateLimit: data.rateLimit ?? DEFAULT_RATE_LIMIT,
        ipWhitelist: data.ipWhitelist ?? [],
        environment: data.environment ?? "live",
        isActive: true,
        createdBy: session!.user.id,
        notes: data.notes ?? null,
      })
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_GENERATED",
      entity: "ApiKey",
      entityId: row.id,
      metadata: { name: row.name, environment: row.environment, courseId: row.courseId },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        key: plainKey,
        ...serializeApiKey(row, { courseTitle: course.title }),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/super-admin/api-keys] POST:", err);
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
  }
}

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
import { DEFAULT_LEAD_FIELDS, DEFAULT_RATE_LIMIT, RECORDINGS_KEY_PERMISSIONS, WIDGET_KEY_DEFAULT_PERMISSIONS } from "@/lib/api-key-types";
import { serializeApiKey, insertApiKeySafe, selectApiKeysSafe } from "@/lib/api-key-admin";
import { buildEmbedSnippet } from "@/lib/widget/build-embed-snippet";
import { generateUniqueFormSlug } from "@/lib/widget/form-slug";
import { getApiKeyListSummaries } from "@/lib/widget/widget-stats";

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

    const list = await selectApiKeysSafe(
      conditions.length ? and(...conditions) : undefined,
      desc(apiKeys.createdAt)
    );

    const courseIds = [
      ...new Set(
        list.flatMap((k) => {
          const allowed = (k.allowedCourses ?? []) as string[];
          if (allowed.length > 0) return allowed;
          return k.courseId ? [k.courseId] : [];
        })
      ),
    ];
    const courseRows =
      courseIds.length > 0
        ? await db
            .select({ id: recordCourses.id, title: recordCourses.title, price: recordCourses.price })
            .from(recordCourses)
            .where(inArray(recordCourses.id, courseIds))
        : [];
    const courseTitleById = new Map(courseRows.map((c) => [c.id, c.title]));
    const coursePriceById = new Map(courseRows.map((c) => [c.id, parseFloat(c.price)]));
    const statsByKey = await getApiKeyListSummaries(list.map((k) => k.id));

    return NextResponse.json(
      list.map((k) => {
        const allowed = ((k.allowedCourses ?? []) as string[]).filter(Boolean);
        const ids = allowed.length > 0 ? allowed : k.courseId ? [k.courseId] : [];
        const titles = ids.map((id) => courseTitleById.get(id)).filter(Boolean) as string[];
        const isRecordingsKey = ((k.permissions ?? []) as string[]).includes("get_recordings");
        const stats = statsByKey.get(k.id);
        return {
          ...serializeApiKey(k, {
            courseTitle:
              titles.length > 1
                ? `${titles.length} courses`
                : titles[0] ?? null,
            coursePrice: titles.length === 1 && ids[0] ? (coursePriceById.get(ids[0]!) ?? null) : null,
          }),
          keyType: isRecordingsKey ? "recordings" : "widget",
          courseTitles: titles,
          allowedCourses: ids,
          totalLeads: stats?.totalLeads ?? 0,
          totalConversions: stats?.totalConversions ?? 0,
          conversionRate: stats?.conversionRate ?? 0,
          totalRevenue: stats?.totalRevenue ?? 0,
        };
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/super-admin/api-keys] GET:", err);
    const schemaOutdated =
      /(course_id|form_slug)/i.test(message) &&
      (/does not exist|unknown column/i.test(message) || /column/i.test(message));
    return NextResponse.json(
      {
        error: schemaOutdated
          ? "Database schema is outdated. Run npm run db:push on the server, then try again."
          : "Failed to fetch API keys",
        ...(process.env.NODE_ENV !== "production" ? { details: message } : {}),
      },
      { status: 500 }
    );
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
    const isRecordingsKey = data.keyType === "recordings";

    const courseIds = isRecordingsKey
      ? [...new Set(data.allowedCourses ?? [])]
      : data.courseId
        ? [data.courseId]
        : [];

    if (courseIds.length === 0) {
      return NextResponse.json({ error: "Select at least one course" }, { status: 400 });
    }

    const courseRows = await db
      .select({ id: recordCourses.id, title: recordCourses.title, price: recordCourses.price })
      .from(recordCourses)
      .where(inArray(recordCourses.id, courseIds));

    if (courseRows.length !== courseIds.length) {
      return NextResponse.json({ error: "One or more courses were not found" }, { status: 400 });
    }

    const primaryCourse = courseRows.find((c) => c.id === courseIds[0]) ?? courseRows[0]!;

    const plainKey = generatePlainApiKey(data.environment);
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = extractDisplayPrefix(plainKey);
    const formSlug = isRecordingsKey ? null : await generateUniqueFormSlug(data.name);

    const defaultPermissions = data.permissions?.length
      ? data.permissions
      : isRecordingsKey
        ? RECORDINGS_KEY_PERMISSIONS
        : WIDGET_KEY_DEFAULT_PERMISSIONS;

    const insertValues = {
      name: data.name,
      keyPrefix,
      keyHash,
      permissions: defaultPermissions,
      courseId: primaryCourse.id,
      allowedCourses: courseIds,
      allowedPaymentGateway: data.allowedPaymentGateway ?? "any",
      webhookUrl: data.webhookUrl ?? null,
      webhookSecret: data.webhookSecret ?? null,
      leadFields: data.leadFields ?? DEFAULT_LEAD_FIELDS,
      autoCreateStudent: isRecordingsKey ? false : (data.autoCreateStudent ?? true),
      sendWelcomeEmail: isRecordingsKey ? false : (data.sendWelcomeEmail ?? true),
      notifyWebhook: data.notifyWebhook ?? false,
      rateLimit: data.rateLimit ?? DEFAULT_RATE_LIMIT,
      ipWhitelist: data.ipWhitelist ?? [],
      widgetDomainsAllowed: data.widgetDomainsAllowed ?? [],
      redirectOnSuccess: data.redirectOnSuccess ?? "/login",
      redirectOnFailure: data.redirectOnFailure ?? null,
      expiresAt: data.expiresAt ?? null,
      environment: data.environment ?? "live",
      isActive: true,
      createdBy: session!.user.id,
      notes: data.notes ?? null,
    };

    const row = await insertApiKeySafe(insertValues, formSlug);

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_GENERATED",
      entity: "ApiKey",
      entityId: row.id,
      metadata: {
        name: row.name,
        environment: row.environment,
        courseId: row.courseId,
        keyType: data.keyType ?? "widget",
        allowedCourses: courseIds,
      },
      ipAddress: getClientIp(request),
    });

    const courseTitles = courseRows.map((c) => c.title);

    return NextResponse.json(
      {
        ...serializeApiKey(row, {
          courseTitle:
            courseTitles.length > 1
              ? `${courseTitles.length} courses`
              : primaryCourse.title,
          coursePrice: courseTitles.length === 1 ? parseFloat(primaryCourse.price) : null,
        }),
        key: plainKey,
        embedSnippet: isRecordingsKey ? null : buildEmbedSnippet(plainKey),
        keyType: data.keyType ?? "widget",
        allowedCourses: courseIds,
        courseTitles,
        recordingsEndpoint: isRecordingsKey ? "/api/external/recordings" : null,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/super-admin/api-keys] POST:", err);
    const schemaOutdated =
      /(course_id|form_slug)/i.test(message) &&
      (/does not exist|unknown column/i.test(message) || /column/i.test(message));
    return NextResponse.json(
      {
        error: schemaOutdated
          ? "Database schema is outdated. Run npm run db:push on the server, then try again."
          : "Failed to generate API key",
        ...(process.env.NODE_ENV !== "production" ? { details: message } : {}),
      },
      { status: 500 }
    );
  }
}

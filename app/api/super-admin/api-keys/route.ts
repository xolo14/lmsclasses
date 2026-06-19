import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
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

    return NextResponse.json(list.map((k) => serializeApiKey(k)));
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
        allowedCourses: data.allowedCourses ?? [],
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
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        notes: data.notes ?? null,
      })
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_GENERATED",
      entity: "ApiKey",
      entityId: row.id,
      metadata: { name: row.name, environment: row.environment },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      { key: plainKey, ...serializeApiKey(row) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/super-admin/api-keys] POST:", err);
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  apiKeys,
  apiKeyUsageLogs,
  partnerLeads,
  widgetEvents,
  widgetLeads,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { updateApiKeySchema } from "@/lib/validations/api-key";
import {
  generatePlainApiKey,
  hashApiKey,
  extractDisplayPrefix,
} from "@/lib/api-key-service";
import { serializeApiKey, serializeApiKeyWithCourse, selectApiKeysSafe } from "@/lib/api-key-admin";
import { buildEmbedSnippet } from "@/lib/widget/build-embed-snippet";
import { ensureFormSlug } from "@/lib/widget/form-slug";
import { isRecordingsApiKey } from "@/lib/api-key-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  const [row] = await selectApiKeysSafe(eq(apiKeys.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Widget keys get a hosted form slug; recordings keys are API-only (no enroll link).
  if (isRecordingsApiKey(row)) {
    if (row.formSlug) {
      await db
        .update(apiKeys)
        .set({ formSlug: null, updatedAt: new Date() })
        .where(eq(apiKeys.id, id));
    }
    return NextResponse.json(
      await serializeApiKeyWithCourse({ ...row, formSlug: null }, { includeSecrets: true })
    );
  }

  const formSlug = row.formSlug ?? (await ensureFormSlug(row));
  return NextResponse.json(
    await serializeApiKeyWithCourse({ ...row, formSlug }, { includeSecrets: true })
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json();

    if (body.action === "toggle") {
      const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const [updated] = await db
        .update(apiKeys)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();
      return NextResponse.json({ id: updated.id, isActive: updated.isActive });
    }

    const parsed = updateApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const data = parsed.data;
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [updated] = await db
      .update(apiKeys)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.courseId !== undefined && {
          courseId: data.courseId,
          ...(data.courseId && data.allowedCourses === undefined
            ? { allowedCourses: [data.courseId] }
            : {}),
        }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.allowedCourses !== undefined && { allowedCourses: data.allowedCourses }),
        ...(data.allowedPaymentGateway !== undefined && {
          allowedPaymentGateway: data.allowedPaymentGateway,
        }),
        ...(data.webhookUrl !== undefined && { webhookUrl: data.webhookUrl }),
        ...(data.webhookSecret !== undefined && { webhookSecret: data.webhookSecret }),
        ...(data.leadFields !== undefined && { leadFields: data.leadFields }),
        ...(data.autoCreateStudent !== undefined && { autoCreateStudent: data.autoCreateStudent }),
        ...(data.sendWelcomeEmail !== undefined && { sendWelcomeEmail: data.sendWelcomeEmail }),
        ...(data.notifyWebhook !== undefined && { notifyWebhook: data.notifyWebhook }),
        ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
        ...(data.ipWhitelist !== undefined && { ipWhitelist: data.ipWhitelist }),
        ...(data.environment !== undefined && { environment: data.environment }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_UPDATED",
      entity: "ApiKey",
      entityId: id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(await serializeApiKeyWithCourse(updated, { includeSecrets: true }));
  } catch (err) {
    console.error("[api/super-admin/api-keys/:id] PATCH:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  try {
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // neon-http does not support interactive transactions — delete children then the key.
    await db.delete(apiKeyUsageLogs).where(eq(apiKeyUsageLogs.apiKeyId, id));
    await db.delete(widgetEvents).where(eq(widgetEvents.apiKeyId, id));
    await db.delete(widgetLeads).where(eq(widgetLeads.apiKeyId, id));
    await db
      .update(partnerLeads)
      .set({ apiKeyId: null, updatedAt: new Date() })
      .where(eq(partnerLeads.apiKeyId, id));
    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_DELETED",
      entity: "ApiKey",
      entityId: id,
      metadata: { name: existing.name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/super-admin/api-keys/:id] DELETE:", err);
    return NextResponse.json(
      {
        error:
          /foreign key|violates foreign key/i.test(message)
            ? "Delete failed because related records still reference this key"
            : "Delete failed",
        details: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== "rotate") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const plainKey = generatePlainApiKey(
      (existing.environment as "live" | "test") ?? "live"
    );
    const [updated] = await db
      .update(apiKeys)
      .set({
        keyHash: hashApiKey(plainKey),
        keyPrefix: extractDisplayPrefix(plainKey),
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_ROTATED",
      entity: "ApiKey",
      entityId: id,
      ipAddress: getClientIp(request),
    });

    const recordingsKey = isRecordingsApiKey(updated);
    return NextResponse.json({
      ...serializeApiKey(updated),
      key: plainKey,
      embedSnippet: recordingsKey ? null : buildEmbedSnippet(plainKey),
    });
  } catch (err) {
    console.error("[api/super-admin/api-keys/:id] POST rotate:", err);
    return NextResponse.json({ error: "Rotate failed" }, { status: 500 });
  }
}

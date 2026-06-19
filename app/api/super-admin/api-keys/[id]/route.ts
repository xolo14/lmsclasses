import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { updateApiKeySchema } from "@/lib/validations/api-key";
import {
  generatePlainApiKey,
  hashApiKey,
  extractDisplayPrefix,
} from "@/lib/api-key-service";
import { serializeApiKey } from "@/lib/api-key-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeApiKey(row, true));
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
        ...(data.expiresAt !== undefined && {
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        }),
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

    return NextResponse.json(serializeApiKey(updated, true));
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
    console.error("[api/super-admin/api-keys/:id] DELETE:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
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

    return NextResponse.json({ key: plainKey, ...serializeApiKey(updated) });
  } catch (err) {
    console.error("[api/super-admin/api-keys/:id] POST rotate:", err);
    return NextResponse.json({ error: "Rotate failed" }, { status: 500 });
  }
}

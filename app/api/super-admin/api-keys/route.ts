import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { createApiKeySchema } from "@/lib/validations/api-key";
import {
  generatePlainApiKey,
  hashApiKey,
  maskFromPrefix,
} from "@/lib/api-key-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  try {
    const list = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return NextResponse.json(
      list.map((k) => ({
        id: k.id,
        name: k.name,
        maskedKey: maskFromPrefix(k.keyPrefix),
        permissions: k.permissions ?? [],
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      }))
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

    const { name, permissions, expiresAt } = parsed.data;
    const plainKey = generatePlainApiKey();
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = plainKey.slice(-4);

    const [row] = await db
      .insert(apiKeys)
      .values({
        name,
        keyPrefix,
        keyHash,
        permissions,
        isActive: true,
        createdBy: session!.user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    await logAction({
      userId: session!.user.id,
      role: "super_admin",
      action: "API_KEY_GENERATED",
      entity: "ApiKey",
      entityId: row.id,
      metadata: { name, permissions },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(
      {
        key: plainKey,
        keyId: row.id,
        name: row.name,
        permissions: row.permissions,
        expiresAt: row.expiresAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/super-admin/api-keys] POST:", err);
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
  }
}

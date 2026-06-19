import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, apiKeyUsageLogs } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";
import {
  API_KEY_PREFIX,
  extractBearerToken,
  hashApiKey,
  type ApiPermission,
} from "@/lib/api-key-service";
import { getClientIp } from "@/lib/audit";

const RATE_LIMIT_PER_MINUTE = 100;

export type ApiKeyContext = {
  apiKey: ApiKey;
  ipAddress?: string;
};

async function countRecentUsage(apiKeyId: string): Promise<number> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsageLogs)
    .where(and(eq(apiKeyUsageLogs.apiKeyId, apiKeyId), gte(apiKeyUsageLogs.createdAt, oneMinuteAgo)));
  return row?.count ?? 0;
}

export async function logApiKeyUsage({
  apiKey,
  endpoint,
  ipAddress,
  statusCode,
}: {
  apiKey: ApiKey;
  endpoint: string;
  ipAddress?: string;
  statusCode: number;
}): Promise<void> {
  db.insert(apiKeyUsageLogs)
    .values({
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      endpoint,
      ipAddress,
      statusCode,
    })
    .catch((err) => console.error("[api-key-usage-log]", err));
}

export async function requireApiKey(
  request: Request,
  permission: ApiPermission,
  endpoint: string
): Promise<{ error?: NextResponse; context?: ApiKeyContext }> {
  const ipAddress = getClientIp(request);
  const token = extractBearerToken(request);

  if (!token || !token.startsWith(API_KEY_PREFIX)) {
    return {
      error: NextResponse.json({ error: "Missing or invalid API key" }, { status: 401 }),
    };
  }

  const keyHash = hashApiKey(token);
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) {
    return {
      error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }),
    };
  }

  if (!apiKey.isActive) {
    await logApiKeyUsage({ apiKey, endpoint, ipAddress, statusCode: 403 });
    return {
      error: NextResponse.json({ error: "API key is disabled" }, { status: 403 }),
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    await logApiKeyUsage({ apiKey, endpoint, ipAddress, statusCode: 403 });
    return {
      error: NextResponse.json({ error: "API key has expired" }, { status: 403 }),
    };
  }

  const permissions = (apiKey.permissions ?? []) as string[];
  if (!permissions.includes(permission)) {
    await logApiKeyUsage({ apiKey, endpoint, ipAddress, statusCode: 403 });
    return {
      error: NextResponse.json(
        { error: `API key lacks required permission: ${permission}` },
        { status: 403 }
      ),
    };
  }

  const recentCount = await countRecentUsage(apiKey.id);
  if (recentCount >= RATE_LIMIT_PER_MINUTE) {
    await logApiKeyUsage({ apiKey, endpoint, ipAddress, statusCode: 429 });
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Maximum 100 requests per minute." },
        { status: 429 }
      ),
    };
  }

  db.update(apiKeys)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKeys.id, apiKey.id))
    .catch((err) => console.error("[api-key-last-used]", err));

  return { context: { apiKey, ipAddress } };
}

export async function finishApiKeyRequest(
  apiKey: ApiKey,
  endpoint: string,
  ipAddress: string | undefined,
  response: NextResponse
): Promise<NextResponse> {
  await logApiKeyUsage({
    apiKey,
    endpoint,
    ipAddress,
    statusCode: response.status,
  });
  return response;
}

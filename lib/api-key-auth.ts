import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, apiKeyUsageLogs } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import {
  extractBearerToken,
  hashApiKey,
  isValidApiKeyFormat,
  sanitizeLogBody,
  courseAllowed,
} from "@/lib/api-key-service";
import type { ApiPermission } from "@/lib/api-key-types";
import { DEFAULT_RATE_LIMIT } from "@/lib/api-key-types";
import { getClientIp } from "@/lib/audit";

export type ApiKeyContext = {
  apiKey: ApiKey;
  ipAddress?: string;
  startTime: number;
};

async function countRecentUsage(
  apiKeyId: string,
  windowMinutes: number
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiKeyUsageLogs)
    .where(and(eq(apiKeyUsageLogs.apiKeyId, apiKeyId), gte(apiKeyUsageLogs.createdAt, since)));
  return row?.count ?? 0;
}

export async function logApiKeyUsage({
  apiKey,
  endpoint,
  method,
  ipAddress,
  statusCode,
  requestBody,
  responseTimeMs,
  leadId,
  error,
}: {
  apiKey: ApiKey;
  endpoint: string;
  method?: string;
  ipAddress?: string;
  statusCode: number;
  requestBody?: unknown;
  responseTimeMs?: number;
  leadId?: string;
  error?: string;
}): Promise<void> {
  db.insert(apiKeyUsageLogs)
    .values({
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      endpoint,
      method,
      ipAddress,
      requestBody: sanitizeLogBody(requestBody),
      statusCode,
      responseTimeMs,
      leadId,
      error,
    })
    .catch((err) => console.error("[api-key-usage-log]", err));
}

export { courseAllowed, isTestKey } from "@/lib/api-key-service";

export async function requireApiKey(
  request: Request,
  permission: ApiPermission,
  endpoint: string
): Promise<{ error?: NextResponse; context?: ApiKeyContext }> {
  const startTime = Date.now();
  const ipAddress = getClientIp(request);
  const token = extractBearerToken(request);

  if (!token || !isValidApiKeyFormat(token)) {
    return { error: ApiKeyErrors.invalidKey() };
  }

  const keyHash = hashApiKey(token);
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) {
    return { error: ApiKeyErrors.invalidKey() };
  }

  if (!apiKey.isActive) {
    await logApiKeyUsage({ apiKey, endpoint, method: request.method, ipAddress, statusCode: 403 });
    return { error: ApiKeyErrors.disabled() };
  }

  const whitelist = (apiKey.ipWhitelist ?? []) as string[];
  if (whitelist.length > 0 && ipAddress && !whitelist.includes(ipAddress)) {
    await logApiKeyUsage({ apiKey, endpoint, method: request.method, ipAddress, statusCode: 403 });
    return { error: ApiKeyErrors.ipNotWhitelisted(ipAddress) };
  }

  const permissions = (apiKey.permissions ?? []) as string[];
  if (!permissions.includes(permission)) {
    await logApiKeyUsage({ apiKey, endpoint, method: request.method, ipAddress, statusCode: 403 });
    return { error: ApiKeyErrors.permissionDenied(permission) };
  }

  const rateLimit = (apiKey.rateLimit as { requests?: number; windowMinutes?: number }) ?? DEFAULT_RATE_LIMIT;
  const maxRequests = rateLimit.requests ?? DEFAULT_RATE_LIMIT.requests;
  const windowMinutes = rateLimit.windowMinutes ?? DEFAULT_RATE_LIMIT.windowMinutes;
  const recentCount = await countRecentUsage(apiKey.id, windowMinutes);
  if (recentCount >= maxRequests) {
    await logApiKeyUsage({ apiKey, endpoint, method: request.method, ipAddress, statusCode: 429 });
    return { error: ApiKeyErrors.rateLimitExceeded(maxRequests, windowMinutes) };
  }

  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeys.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKey.id))
    .catch((err) => console.error("[api-key-last-used]", err));

  return { context: { apiKey, ipAddress, startTime } };
}

export async function finishApiKeyRequest(
  ctx: ApiKeyContext,
  endpoint: string,
  response: NextResponse,
  options?: { requestBody?: unknown; leadId?: string; error?: string }
): Promise<NextResponse> {
  await logApiKeyUsage({
    apiKey: ctx.apiKey,
    endpoint,
    ipAddress: ctx.ipAddress,
    statusCode: response.status,
    responseTimeMs: Date.now() - ctx.startTime,
    requestBody: options?.requestBody,
    leadId: options?.leadId,
    error: options?.error,
  });
  return response;
}

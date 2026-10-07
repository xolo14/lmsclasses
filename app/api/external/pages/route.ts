import { NextResponse } from "next/server";
import { extractBearerToken, hashApiKey, isValidApiKeyFormat } from "@/lib/api-key-service";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { API_PAGES, pagesFromPermissions } from "@/lib/api-key-types";
import { ApiKeyErrors } from "@/lib/api-key-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token || !isValidApiKeyFormat(token)) return ApiKeyErrors.invalidKey();
  const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hashApiKey(token))).limit(1);
  if (!apiKey || !apiKey.isActive) return ApiKeyErrors.invalidKey();

  return NextResponse.json({
    pages: pagesFromPermissions(apiKey.permissions),
    endpoints: API_PAGES.filter((p) =>
      ((apiKey.permissions ?? []) as string[]).includes(`page:${p.id}`)
    ).map((p) => ({
      id: p.id,
      label: p.label,
      url: `/api/external/pages/${p.id}`,
    })),
  });
}

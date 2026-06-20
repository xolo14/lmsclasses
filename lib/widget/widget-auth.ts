import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";
import { hashApiKey, isValidApiKeyFormat } from "@/lib/api-key-service";
import { getClientIp } from "@/lib/audit";
import { domainAllowed } from "@/lib/widget/widget-cors";
import { countWidgetSubmitsInWindow, logWidgetEvent } from "@/lib/widget/widget-events";
import { withWidgetCors } from "@/lib/widget/widget-cors";

const SUBMIT_RATE_LIMIT = 30;
const SUBMIT_WINDOW_MINUTES = 60;

export type WidgetAuthContext = {
  apiKey: ApiKey;
  ipAddress?: string;
  domain?: string | null;
};

function widgetError(
  apiKey: ApiKey | null,
  request: Request,
  status: number,
  code: string,
  message: string
): NextResponse {
  return withWidgetCors(
    NextResponse.json({ error: code, message }, { status }),
    apiKey,
    request
  );
}

export async function resolveWidgetApiKey(
  plainKey: string | null | undefined,
  request: Request,
  options?: { checkDomain?: boolean; logInvalid?: boolean }
): Promise<{ error?: NextResponse; context?: WidgetAuthContext }> {
  const ipAddress = getClientIp(request);

  if (!plainKey || !isValidApiKeyFormat(plainKey)) {
    return { error: widgetError(null, request, 401, "INVALID_KEY", "Invalid API key") };
  }

  const keyHash = hashApiKey(plainKey);
  const [apiKey] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!apiKey) {
    return { error: widgetError(null, request, 401, "INVALID_KEY", "Invalid API key") };
  }

  if (!apiKey.isActive) {
    if (options?.logInvalid) {
      await logWidgetEvent({
        apiKey,
        eventType: "widget_loaded",
        ipAddress,
        metadata: { rejected: "KEY_DISABLED" },
      });
    }
    return {
      error: widgetError(apiKey, request, 403, "KEY_DISABLED", "This enrollment form is disabled"),
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
    return {
      error: widgetError(apiKey, request, 410, "KEY_EXPIRED", "This enrollment form has expired"),
    };
  }

  if (options?.checkDomain !== false && !domainAllowed(apiKey, request)) {
    await logWidgetEvent({
      apiKey,
      eventType: "widget_loaded",
      ipAddress,
      metadata: { rejected: "DOMAIN_NOT_ALLOWED" },
    });
    return {
      error: widgetError(
        apiKey,
        request,
        403,
        "DOMAIN_NOT_ALLOWED",
        "This form cannot be embedded on this website"
      ),
    };
  }

  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: sql`${apiKeys.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKey.id))
    .catch(console.error);

  return {
    context: {
      apiKey,
      ipAddress,
      domain: request.headers.get("origin") ?? null,
    },
  };
}

export async function checkWidgetSubmitRateLimit(
  ctx: WidgetAuthContext,
  request: Request
): Promise<NextResponse | null> {
  const count = await countWidgetSubmitsInWindow(
    ctx.apiKey.id,
    ctx.ipAddress,
    SUBMIT_WINDOW_MINUTES
  );
  if (count >= SUBMIT_RATE_LIMIT) {
    return widgetError(
      ctx.apiKey,
      request,
      429,
      "RATE_LIMIT_EXCEEDED",
      `Too many submissions. Try again in ${SUBMIT_WINDOW_MINUTES} minutes.`
    );
  }
  return null;
}

export function widgetJson(
  ctx: WidgetAuthContext,
  request: Request,
  body: unknown,
  status = 200
): NextResponse {
  return withWidgetCors(NextResponse.json(body, { status }), ctx.apiKey, request);
}

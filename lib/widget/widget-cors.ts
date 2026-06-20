import { NextResponse } from "next/server";
import type { ApiKey } from "@/lib/db/schema";

export function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function getRequestDomain(request: Request): string | null {
  const origin = getRequestOrigin(request);
  if (!origin) return null;
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

export function domainAllowed(apiKey: ApiKey, request: Request): boolean {
  const allowed = (apiKey.widgetDomainsAllowed ?? []) as string[];
  if (allowed.length === 0) return true;

  const domain = getRequestDomain(request);
  if (!domain) return false;

  return allowed.some((entry) => {
    const normalized = entry.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    return domain.toLowerCase() === normalized || domain.toLowerCase().endsWith(`.${normalized}`);
  });
}

export function corsOriginForKey(apiKey: ApiKey, request: Request): string {
  const allowed = (apiKey.widgetDomainsAllowed ?? []) as string[];
  const origin = getRequestOrigin(request);
  if (allowed.length === 0) return origin ?? "*";
  if (origin && domainAllowed(apiKey, request)) return origin;
  return allowed[0] ? `https://${allowed[0].replace(/^https?:\/\//, "")}` : "*";
}

export function withWidgetCors(
  response: NextResponse,
  apiKey: ApiKey | null,
  request: Request
): NextResponse {
  const origin = apiKey ? corsOriginForKey(apiKey, request) : (getRequestOrigin(request) ?? "*");
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Vary", "Origin");
  return response;
}

export function widgetOptionsResponse(apiKey: ApiKey | null, request: Request): NextResponse {
  return withWidgetCors(new NextResponse(null, { status: 204 }), apiKey, request);
}

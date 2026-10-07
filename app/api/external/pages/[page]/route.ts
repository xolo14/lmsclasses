import { NextResponse } from "next/server";
import { requireApiPage, finishApiKeyRequest } from "@/lib/api-key-auth";
import { ApiKeyErrors } from "@/lib/api-key-errors";
import {
  PagesApiError,
  createPageItem,
  listPage,
} from "@/lib/api-pages-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof PagesApiError) {
    return NextResponse.json(
      { error: "PAGES_API_ERROR", message: err.message, fields: err.fields },
      { status: err.status }
    );
  }
  console.error("[external/pages]", err);
  return NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;
  const endpoint = `/api/external/pages/${page}`;
  const auth = await requireApiPage(request, page, endpoint);
  if (auth.error) return auth.error;
  try {
    const data = await listPage(auth.page!);
    return finishApiKeyRequest(auth.context!, endpoint, NextResponse.json({ data }));
  } catch (err) {
    return finishApiKeyRequest(auth.context!, endpoint, fail(err), { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page } = await params;
  const endpoint = `/api/external/pages/${page}`;
  const auth = await requireApiPage(request, page, endpoint);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return finishApiKeyRequest(auth.context!, endpoint, ApiKeyErrors.validationFailed({ body: "JSON object required" }));
  }
  try {
    const data = await createPageItem(auth.page!, body, {
      apiKeyId: auth.context!.apiKey.id,
      apiKeyName: auth.context!.apiKey.name,
    });
    return finishApiKeyRequest(
      auth.context!,
      endpoint,
      NextResponse.json({ data }, { status: 201 }),
      { requestBody: body }
    );
  } catch (err) {
    return finishApiKeyRequest(auth.context!, endpoint, fail(err), {
      requestBody: body,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

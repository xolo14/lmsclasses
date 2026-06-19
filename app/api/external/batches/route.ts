import { NextResponse } from "next/server";
import { requireApiKey, finishApiKeyRequest } from "@/lib/api-key-auth";
import { getBatchScheduleForApiKey } from "@/lib/partner-course-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "/api/external/batches";

export async function GET(request: Request) {
  const auth = await requireApiKey(request, "get_batch_schedule", ENDPOINT);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  try {
    const batches = await getBatchScheduleForApiKey(ctx.apiKey);
    return finishApiKeyRequest(ctx, ENDPOINT, NextResponse.json({ batches }));
  } catch (err) {
    console.error("[external/batches] GET:", err);
    return finishApiKeyRequest(
      ctx,
      ENDPOINT,
      NextResponse.json({ error: "INTERNAL_ERROR", message: "Internal server error" }, { status: 500 })
    );
  }
}

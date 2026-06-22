import { NextResponse } from "next/server";
import {
  checkWidgetSubmitRateLimit,
  resolveApiKeyByFormSlug,
} from "@/lib/widget/widget-auth";
import { getHostedEnrollConfig } from "@/lib/widget/widget-enroll-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formSlug: string }> }
) {
  const { formSlug } = await params;
  const auth = await resolveApiKeyByFormSlug(formSlug, _request);
  if (auth.error) return auth.error;
  return getHostedEnrollConfig(auth.context!, _request);
}

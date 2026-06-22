import { NextResponse } from "next/server";
import {
  checkWidgetSubmitRateLimit,
  resolveApiKeyByFormSlug,
} from "@/lib/widget/widget-auth";
import { processHostedEnrollSubmit } from "@/lib/widget/widget-enroll-core";
import { hostedSubmitSchema } from "@/lib/validations/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formSlug: string }> }
) {
  const { formSlug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hostedSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        message: "Invalid form data",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const auth = await resolveApiKeyByFormSlug(formSlug, request);
  if (auth.error) return auth.error;
  const ctx = auth.context!;

  const rateError = await checkWidgetSubmitRateLimit(ctx, request);
  if (rateError) {
    const json = await rateError.json();
    return NextResponse.json(json, { status: rateError.status });
  }

  return processHostedEnrollSubmit(
    ctx,
    {
      ...parsed.data,
      landingPageUrl: parsed.data.landingPageUrl ?? request.headers.get("referer"),
    },
    request
  );
}

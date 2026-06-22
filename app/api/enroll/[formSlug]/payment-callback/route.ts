import { NextResponse } from "next/server";
import { resolveApiKeyByFormSlug } from "@/lib/widget/widget-auth";
import { processHostedPaymentCallback } from "@/lib/widget/widget-enroll-core";
import { hostedPaymentCallbackSchema } from "@/lib/validations/widget";

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

  const parsed = hostedPaymentCallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", message: "Invalid callback payload" },
      { status: 422 }
    );
  }

  const auth = await resolveApiKeyByFormSlug(formSlug, request);
  if (auth.error) return auth.error;

  return processHostedPaymentCallback(auth.context!, parsed.data, request);
}

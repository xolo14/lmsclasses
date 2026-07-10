import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getMetaWhatsAppConfigSummary, testMetaWhatsAppDelivery } from "@/lib/meta-whatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const testSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  studentName: z.string().optional(),
});

export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const config = getMetaWhatsAppConfigSummary();
  return NextResponse.json({
    ...config,
    message: config.configured
      ? "Meta WhatsApp env vars are set. POST with { phone } to send a test message."
      : "Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID on the server.",
    triggers: [
      "WhatsApp sends when a live class is created with a meeting link",
      "WhatsApp re-sends when a live class meeting link is updated",
      "Students must have a valid phone and active enrollment in the course/batch",
    ],
  });
}

export async function POST(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const result = await testMetaWhatsAppDelivery({
    phone: parsed.data.phone,
    studentName: parsed.data.studentName,
  });

  const ok = result.send.ok;
  return NextResponse.json(
    {
      ok,
      ...result,
      hint: ok
        ? "Check the phone for the WhatsApp template message."
        : "Confirm the template name/language match Meta Business Manager, and the token has whatsapp_business_messaging permission.",
    },
    { status: ok ? 200 : 502 }
  );
}

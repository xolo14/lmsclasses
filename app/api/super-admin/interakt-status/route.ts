import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getInteraktConfigSummary, testInteraktDelivery } from "@/lib/interakt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const testSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
  studentName: z.string().optional(),
});

export async function GET() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const config = getInteraktConfigSummary();
  return NextResponse.json({
    ...config,
    message: config.configured
      ? "Interakt env vars are set. POST to this endpoint with { phone } to send a test WhatsApp."
      : "Set INTERAKT_API_KEY and INTERAKT_TEMPLATE_NAME on the server.",
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

  const result = await testInteraktDelivery({
    phone: parsed.data.phone,
    studentName: parsed.data.studentName,
  });

  const ok = result.track.ok && result.send.ok;
  return NextResponse.json(
    {
      ok,
      ...result,
      hint: ok
        ? "Check the phone for the WhatsApp template message."
        : "If track fails with 'Customer matching query does not exist', contact registration may still be required in Interakt.",
    },
    { status: ok ? 200 : 502 }
  );
}

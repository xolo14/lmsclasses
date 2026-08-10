import { NextResponse } from "next/server";
import { reconcileStuckSlotPayments } from "@/lib/payments-fulfill";
import { backfillMissingRecordCourseSlugs } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: repair success payments missing slots; report failed rows that still
 * have a Razorpay payment id; backfill missing record-course slugs.
 * Protect with Authorization: Bearer $CRON_SECRET
 * Suggested schedule: hourly.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [paymentResult, slugsFixed] = await Promise.all([
      reconcileStuckSlotPayments(),
      backfillMissingRecordCourseSlugs(),
    ]);
    return NextResponse.json({
      ok: true,
      payments: paymentResult,
      slugsBackfilled: slugsFixed ?? 0,
    });
  } catch (err) {
    console.error("[cron] payment-reconcile failed:", err);
    const message = err instanceof Error ? err.message : "Reconcile failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

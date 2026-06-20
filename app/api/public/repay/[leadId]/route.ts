import { NextResponse } from "next/server";
import { getRepayCheckout } from "@/lib/widget/lead-admin-service";
import { getRazorpayKeyId } from "@/lib/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const sig = new URL(request.url).searchParams.get("sig") ?? "";

  try {
    const checkout = await getRepayCheckout(leadId, sig);
    return NextResponse.json({
      ...checkout,
      razorpayKeyId: getRazorpayKeyId(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid link" },
      { status: 400 }
    );
  }
}

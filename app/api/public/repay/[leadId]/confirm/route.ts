import { NextResponse } from "next/server";
import { confirmRepayPayment } from "@/lib/widget/lead-admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const { searchParams } = new URL(request.url);
  const sig = searchParams.get("sig") ?? "";

  try {
    const body = await request.json();
    const result = await confirmRepayPayment(leadId, sig, {
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_order_id: body.razorpay_order_id,
      razorpay_signature: body.razorpay_signature,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment failed" },
      { status: 400 }
    );
  }
}

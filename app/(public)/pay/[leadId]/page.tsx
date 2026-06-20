import { Suspense } from "react";
import { RepayCheckout } from "@/components/public/RepayCheckout";

export default async function PayLeadPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Loading…</div>}>
      <RepayCheckout leadId={leadId} />
    </Suspense>
  );
}

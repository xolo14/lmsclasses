import { Suspense } from "react";
import { HostedEnrollForm } from "@/components/public/HostedEnrollForm";
import { SwissAuthShell } from "@/components/layout/SwissAuthShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HostedEnrollPage({
  params,
}: {
  params: Promise<{ formSlug: string }>;
}) {
  const { formSlug } = await params;

  return (
    <SwissAuthShell title="Enroll" subtitle="Secure course enrollment">
      <Suspense
        fallback={
          <div className="rounded-sm border border-swiss-black/10 bg-white p-10 text-center text-sm text-swiss-muted">
            Loading…
          </div>
        }
      >
        <HostedEnrollForm formSlug={formSlug} />
      </Suspense>
    </SwissAuthShell>
  );
}

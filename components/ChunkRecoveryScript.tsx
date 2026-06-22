import Script from "next/script";
import { CHUNK_RECOVERY_SCRIPT } from "@/lib/chunk-recovery";

/** Runs before React so stale _next/static URLs recover without showing a broken login. */
export function ChunkRecoveryScript() {
  return (
    <Script
      id="lms-chunk-recovery"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }}
    />
  );
}

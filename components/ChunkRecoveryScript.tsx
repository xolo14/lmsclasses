import { CHUNK_RECOVERY_SCRIPT } from "@/lib/chunk-recovery";

export function ChunkRecoveryScript() {
  return (
    <script
      id="lms-chunk-recovery"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY_SCRIPT }}
    />
  );
}

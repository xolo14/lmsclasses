/** Server-only. live-recording-slots.ts is also imported by client components. */

let extraSlotColumns: boolean | null = null;

export function liveRecordingSlotColumnsMissing(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /recording_url_b|recording_url_c/i.test(msg);
}

export function setLiveRecordingSlotColumnsAvailable(available: boolean) {
  extraSlotColumns = available;
}

export async function withLiveRecordingSlotColumns<T>(
  withSlots: () => Promise<T>,
  withoutSlots: () => Promise<T>
): Promise<T> {
  if (extraSlotColumns === false) return withoutSlots();
  try {
    const result = await withSlots();
    extraSlotColumns = true;
    return result;
  } catch (err) {
    if (!liveRecordingSlotColumnsMissing(err)) throw err;
    extraSlotColumns = false;
    return withoutSlots();
  }
}

export const LIVE_RECORDING_SLOTS = ["A", "B", "C"] as const;
export type LiveRecordingSlot = (typeof LIVE_RECORDING_SLOTS)[number];

export type LiveRecordingRow = {
  recordingUrl?: string | null;
  recordingUrlB?: string | null;
  recordingUrlC?: string | null;
};

export function liveRecordingColumn(
  slot: LiveRecordingSlot
): "recordingUrl" | "recordingUrlB" | "recordingUrlC" {
  if (slot === "B") return "recordingUrlB";
  if (slot === "C") return "recordingUrlC";
  return "recordingUrl";
}

export function liveRecordingSlotsFromRow(row: LiveRecordingRow): { slot: LiveRecordingSlot; url: string }[] {
  const out: { slot: LiveRecordingSlot; url: string }[] = [];
  if (row.recordingUrl) out.push({ slot: "A", url: row.recordingUrl });
  if (row.recordingUrlB) out.push({ slot: "B", url: row.recordingUrlB });
  if (row.recordingUrlC) out.push({ slot: "C", url: row.recordingUrlC });
  return out;
}

export function liveClassHasAnyRecording(row: LiveRecordingRow) {
  return liveRecordingSlotsFromRow(row).length > 0;
}

export function firstEmptyLiveRecordingSlot(row: LiveRecordingRow): LiveRecordingSlot {
  if (!row.recordingUrl) return "A";
  if (!row.recordingUrlB) return "B";
  if (!row.recordingUrlC) return "C";
  return "A";
}

export function liveRecordingSlotTitle(title: string, slot: LiveRecordingSlot) {
  return `${title} (${slot})`;
}

/** One studio video uses the class title only; two or three add (A) / (B) / (C). */
export function liveRecordingDisplayTitle(
  title: string,
  slot: LiveRecordingSlot,
  slotCount: number
) {
  return slotCount > 1 ? liveRecordingSlotTitle(title, slot) : title;
}

export function liveRecordingWatchLabel(slot: LiveRecordingSlot, slotCount: number) {
  return slotCount > 1 ? `Watch ${slot}` : "Watch";
}

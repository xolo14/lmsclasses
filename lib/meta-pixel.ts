export const META_PIXEL_ID = "1329697255159990";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMetaPurchase(transactionId: string, value: number, currency = "INR") {
  if (typeof window === "undefined" || !window.fbq || !transactionId) return;

  const dedupeKey = `meta-purchase-${transactionId}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // ignore
  }

  window.fbq("track", "Purchase", {
    value,
    currency,
    content_type: "course",
  });
}

export const GOOGLE_ADS_ID = "AW-18228956796";
export const GOOGLE_ADS_PURCHASE_SEND_TO = `${GOOGLE_ADS_ID}/leGOCMKBlr4cEPycn_RD`;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire Google Ads Purchase conversion once per transaction (Razorpay payment ID). */
export function trackGoogleAdsPurchase(transactionId: string) {
  if (typeof window === "undefined" || !window.gtag || !transactionId) return;

  const dedupeKey = `gads-purchase-${transactionId}`;
  try {
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // sessionStorage unavailable — still attempt tracking
  }

  window.gtag("event", "conversion", {
    send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
    transaction_id: transactionId,
  });
}

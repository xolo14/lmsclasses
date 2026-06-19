import { createHmac } from "crypto";
import type { PartnerLead } from "@/lib/db/schema";
import type { ApiKey } from "@/lib/db/schema";

type WebhookPayload = {
  event: string;
  leadId: string;
  timestamp: string;
  data: Record<string, unknown>;
};

function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function notifyPartnerWebhook(
  apiKey: ApiKey,
  event: string,
  lead: PartnerLead,
  extra?: Record<string, unknown>
): Promise<void> {
  if (!apiKey.notifyWebhook || !apiKey.webhookUrl) return;

  const payload: WebhookPayload = {
    event,
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    data: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      course: lead.course,
      paymentId: lead.paymentId,
      amountPaid: lead.amountPaidPaise ? lead.amountPaidPaise / 100 : undefined,
      currency: lead.paymentCurrency ?? "INR",
      utmSource: lead.utmSource,
      utmCampaign: lead.utmCampaign,
      ...extra,
    },
  };

  const body = JSON.stringify(payload);
  const secret = apiKey.webhookSecret || process.env.API_WEBHOOK_DEFAULT_SECRET || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "LMSClasses-Webhook/1.0",
  };
  if (secret) {
    headers["X-LMS-Signature"] = signPayload(secret, body);
  }

  const deliver = async () => {
    const res = await fetch(apiKey.webhookUrl!, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
  };

  try {
    await deliver();
  } catch (err) {
    console.error("[webhook] first attempt failed:", err);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      await deliver();
    } catch (retryErr) {
      console.error("[webhook] retry failed:", retryErr);
    }
  }
}

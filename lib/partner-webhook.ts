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

	const MAX_RETRIES = 3;
	const BASE_DELAY_MS = 2000;
	const PER_ATTEMPT_TIMEOUT = 10_000;

	const attempt = async (attemptNum: number): Promise<void> => {
		try {
			const res = await fetch(apiKey.webhookUrl!, {
				method: "POST",
				headers,
				body,
				signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT),
			});
			if (res.ok) return;
			const text = await res.text();
			console.warn(
				`[webhook] attempt ${attemptNum} HTTP ${res.status} for ${apiKey.webhookUrl}: ${text.slice(0, 200)}`
			);
		} catch (err) {
			console.warn(`[webhook] attempt ${attemptNum} failed for ${apiKey.webhookUrl}:`, err);
		}

		if (attemptNum < MAX_RETRIES) {
			const delay = BASE_DELAY_MS * Math.pow(2, attemptNum - 1);
			await new Promise((r) => setTimeout(r, delay));
			await attempt(attemptNum + 1);
		} else {
			console.error(
				`[webhook] all ${MAX_RETRIES} attempts failed for ${apiKey.webhookUrl} event=${event} leadId=${lead.id}`
			);
		}
	};

	await attempt(1);
}

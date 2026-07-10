const DEFAULT_API_VERSION = "v21.0";

export type MetaWhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; status?: number };

export function getMetaWhatsAppToken(): string | null {
  return (
    process.env.META_WHATSAPP_TOKEN?.trim() ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() ||
    null
  );
}

export function getMetaWhatsAppPhoneNumberId(): string | null {
  return (
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    null
  );
}

export function getMetaWhatsAppTemplateName(): string {
  return process.env.META_WHATSAPP_TEMPLATE_NAME?.trim() || "live_class_link";
}

export function getMetaWhatsAppTemplateLanguage(): string {
  return process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
}

export function getMetaWhatsAppApiVersion(): string {
  const v = process.env.META_WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION;
  return v.startsWith("v") ? v : `v${v}`;
}

export function getMetaWhatsAppDefaultCountryDigits(): string {
  const raw = process.env.META_WHATSAPP_COUNTRY_CODE?.trim() || "+91";
  return raw.replace(/\D/g, "") || "91";
}

export function isMetaWhatsAppConfigured(): boolean {
  return !!(getMetaWhatsAppToken() && getMetaWhatsAppPhoneNumberId());
}

export function getMetaWhatsAppConfigSummary() {
  const token = getMetaWhatsAppToken();
  return {
    configured: isMetaWhatsAppConfigured(),
    hasToken: !!token,
    phoneNumberIdSet: !!getMetaWhatsAppPhoneNumberId(),
    templateName: getMetaWhatsAppTemplateName(),
    languageCode: getMetaWhatsAppTemplateLanguage(),
    apiVersion: getMetaWhatsAppApiVersion(),
    countryCode: `+${getMetaWhatsAppDefaultCountryDigits()}`,
  };
}

/** Convert stored phone to Meta `to` format: digits only with country code (e.g. 919876543210). */
export function parsePhoneForMeta(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  const defaultCc = getMetaWhatsAppDefaultCountryDigits();
  let digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `${defaultCc}${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return `${defaultCc}${digits.slice(1)}`;
  }
  if (digits.length > 10) {
    return digits;
  }

  return null;
}

function formatStudentGreeting(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Student";
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatScheduledAt(scheduledAt: Date | string): string {
  const date = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt;
  if (Number.isNaN(date.getTime())) return String(scheduledAt);
  const formatted = date.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return `${formatted} IST`;
}

/** Dynamic URL button variable — host/path only (no https://) when template is https://{{1}}. */
function meetingLinkButtonValue(meetingLink: string): string {
  const trimmed = meetingLink.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^https?:\/\//i, "");
}

async function parseMetaResponse(res: Response): Promise<{
  ok: boolean;
  error?: string;
  status: number;
  messageId?: string;
}> {
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // keep raw
  }

  if (!res.ok) {
    let errMsg = text || `Meta WhatsApp HTTP ${res.status}`;
    if (typeof data === "object" && data !== null && "error" in data) {
      const err = (data as { error?: { message?: string; error_user_msg?: string } }).error;
      errMsg = err?.error_user_msg || err?.message || errMsg;
    }
    return { ok: false, error: errMsg, status: res.status };
  }

  const messageId =
    typeof data === "object" &&
    data !== null &&
    "messages" in data &&
    Array.isArray((data as { messages: unknown }).messages) &&
    (data as { messages: Array<{ id?: string }> }).messages[0]?.id
      ? (data as { messages: Array<{ id: string }> }).messages[0]!.id
      : undefined;

  return { ok: true, status: res.status, messageId };
}

export async function sendMetaTemplateMessage(opts: {
  to: string;
  bodyValues: string[];
  buttonUrlVariable?: string;
  templateName?: string;
  languageCode?: string;
}): Promise<MetaWhatsAppSendResult> {
  const token = getMetaWhatsAppToken();
  const phoneNumberId = getMetaWhatsAppPhoneNumberId();
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      error:
        "Meta WhatsApp is not configured (META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID)",
    };
  }

  const templateName = opts.templateName || getMetaWhatsAppTemplateName();
  const languageCode = opts.languageCode || getMetaWhatsAppTemplateLanguage();
  const version = getMetaWhatsAppApiVersion();
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  const components: Array<Record<string, unknown>> = [
    {
      type: "body",
      parameters: opts.bodyValues.map((text) => ({ type: "text", text })),
    },
  ];

  if (opts.buttonUrlVariable) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: opts.buttonUrlVariable }],
    });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: opts.to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    const parsed = await parseMetaResponse(res);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error ?? "Send failed", status: parsed.status };
    }
    return { ok: true, messageId: parsed.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendLiveClassMeetingLinkWhatsApp(opts: {
  studentName: string;
  phone: string;
  classTitle: string;
  courseName: string;
  batchName?: string | null;
  scheduledAt: Date | string;
  meetingLink: string;
  liveClassId: string;
}): Promise<MetaWhatsAppSendResult> {
  const to = parsePhoneForMeta(opts.phone);
  if (!to) {
    return { ok: false, error: `Invalid phone number: ${opts.phone}` };
  }

  const linkButton = meetingLinkButtonValue(opts.meetingLink);
  if (!linkButton) {
    return { ok: false, error: "Meeting link is required" };
  }

  const batchLabel = opts.batchName?.trim() || "Not assigned";
  const scheduledLabel = formatScheduledAt(opts.scheduledAt);

  return sendMetaTemplateMessage({
    to,
    bodyValues: [
      formatStudentGreeting(opts.studentName),
      opts.classTitle.trim(),
      opts.courseName.trim(),
      batchLabel,
      scheduledLabel,
    ],
    buttonUrlVariable: linkButton,
  });
}

/** Super-admin diagnostic: send a test template message via Meta Cloud API. */
export async function testMetaWhatsAppDelivery(opts: {
  phone: string;
  studentName?: string;
}): Promise<{
  configured: boolean;
  send: MetaWhatsAppSendResult;
}> {
  const configured = isMetaWhatsAppConfigured();
  if (!configured) {
    return {
      configured,
      send: {
        ok: false,
        error: "Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID on the server",
      },
    };
  }

  const name = opts.studentName?.trim() || "Test Student";
  const send = await sendLiveClassMeetingLinkWhatsApp({
    studentName: name,
    phone: opts.phone,
    classTitle: "Test Live Class",
    courseName: "Test Course",
    batchName: "Test Batch",
    scheduledAt: new Date(),
    meetingLink: "https://meet.google.com/test-link",
    liveClassId: "test",
  });

  return { configured, send };
}

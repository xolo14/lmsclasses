const INTERAKT_MESSAGE_URL = "https://api.interakt.ai/v1/public/message/";
const INTERAKT_TRACK_USER_URL = "https://api.interakt.ai/v1/public/track/users/";

function interaktHeaders(apiKey: string) {
  return {
    Authorization: `Basic ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function getInteraktConfigSummary() {
  return {
    configured: isInteraktConfigured(),
    templateName: getInteraktTemplateName(),
    countryCode: getInteraktCountryCode(),
    languageCode: getInteraktTemplateLanguage(),
    hasApiKey: !!getInteraktApiKey(),
  };
}

export function isInteraktConfigured(): boolean {
  return !!(
    process.env.INTERAKT_API_KEY?.trim() && process.env.INTERAKT_TEMPLATE_NAME?.trim()
  );
}

export function getInteraktApiKey(): string | null {
  return process.env.INTERAKT_API_KEY?.trim() || null;
}

export function getInteraktTemplateName(): string {
  return process.env.INTERAKT_TEMPLATE_NAME?.trim() || "live_class_link";
}

export function getInteraktCountryCode(): string {
  return process.env.INTERAKT_COUNTRY_CODE?.trim() || "+91";
}

export function getInteraktTemplateLanguage(): string {
  return process.env.INTERAKT_TEMPLATE_LANGUAGE?.trim() || "en";
}

/** Parse stored phone to Interakt countryCode + 10-digit local number (India-first). */
export function parsePhoneForInterakt(
  raw: string | null | undefined
): { countryCode: string; phoneNumber: string } | null {
  if (!raw?.trim()) return null;

  const defaultCode = getInteraktCountryCode();
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return { countryCode: defaultCode, phoneNumber: digits };
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return { countryCode: "+91", phoneNumber: digits.slice(2) };
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return { countryCode: defaultCode, phoneNumber: digits.slice(1) };
  }
  if (digits.length > 10) {
    return { countryCode: defaultCode, phoneNumber: digits.slice(-10) };
  }

  return null;
}

export type InteraktSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; status?: number };

async function parseInteraktResponse(res: Response): Promise<{
  ok: boolean;
  error?: string;
  status: number;
  messageId?: string;
  raw?: string;
}> {
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // keep raw text
  }

  if (!res.ok) {
    const errMsg =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : text || `Interakt HTTP ${res.status}`;
    return { ok: false, error: errMsg, status: res.status, raw: text };
  }

  const messageId =
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof (data as { id: unknown }).id === "string"
      ? (data as { id: string }).id
      : undefined;

  return { ok: true, status: res.status, messageId, raw: text };
}

/** Register or update a contact in Interakt before sending template messages. */
export async function trackInteraktUser(opts: {
  phoneNumber: string;
  countryCode?: string;
  userId?: string;
  traits?: { name?: string; email?: string };
}): Promise<InteraktSendResult> {
  const apiKey = getInteraktApiKey();
  if (!apiKey) {
    return { ok: false, error: "INTERAKT_API_KEY is not configured" };
  }

  const countryCode = opts.countryCode || getInteraktCountryCode();

  try {
    const res = await fetch(INTERAKT_TRACK_USER_URL, {
      method: "POST",
      headers: interaktHeaders(apiKey),
      body: JSON.stringify({
        ...(opts.userId ? { userId: opts.userId } : {}),
        countryCode,
        phoneNumber: opts.phoneNumber,
        ...(opts.traits ? { traits: opts.traits } : {}),
      }),
    });

    const parsed = await parseInteraktResponse(res);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error ?? "Track user failed", status: parsed.status };
    }
    return { ok: true, messageId: parsed.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function sendInteraktTemplateMessage(opts: {
  phoneNumber: string;
  countryCode?: string;
  bodyValues: string[];
  buttonValues?: Record<string, string[]>;
  callbackData?: string;
  templateName?: string;
  languageCode?: string;
}): Promise<InteraktSendResult> {
  const apiKey = getInteraktApiKey();
  if (!apiKey) {
    return { ok: false, error: "INTERAKT_API_KEY is not configured" };
  }

  const templateName = opts.templateName || getInteraktTemplateName();
  const languageCode = opts.languageCode || getInteraktTemplateLanguage();
  const countryCode = opts.countryCode || getInteraktCountryCode();

  try {
    const res = await fetch(INTERAKT_MESSAGE_URL, {
      method: "POST",
      headers: interaktHeaders(apiKey),
      body: JSON.stringify({
        countryCode,
        phoneNumber: opts.phoneNumber,
        callbackData: opts.callbackData ?? "lms-live-class",
        type: "Template",
        template: {
          name: templateName,
          languageCode,
          bodyValues: opts.bodyValues,
          ...(opts.buttonValues ? { buttonValues: opts.buttonValues } : {}),
        },
      }),
    });

    const parsed = await parseInteraktResponse(res);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error ?? "Send failed", status: parsed.status };
    }
    return { ok: true, messageId: parsed.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** First name for a friendly, professional greeting in WhatsApp templates. */
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

/** Template URL is `https://{{6}}` — pass host/path only (no protocol). */
function meetingLinkButtonValue(meetingLink: string): string {
  const trimmed = meetingLink.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^https?:\/\//i, "");
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
}): Promise<InteraktSendResult> {
  const parsed = parsePhoneForInterakt(opts.phone);
  if (!parsed) {
    return { ok: false, error: `Invalid phone number: ${opts.phone}` };
  }

  const batchLabel = opts.batchName?.trim() || "Not assigned";
  const scheduledLabel = formatScheduledAt(opts.scheduledAt);
  const linkButton = meetingLinkButtonValue(opts.meetingLink);
  if (!linkButton) {
    return { ok: false, error: "Meeting link is required" };
  }

  const trackResult = await trackInteraktUser({
    countryCode: parsed.countryCode,
    phoneNumber: parsed.phoneNumber,
    traits: { name: opts.studentName.trim() },
  });
  if (!trackResult.ok) {
    console.warn("[interakt] track user before send:", trackResult.error, {
      phone: opts.phone,
      liveClassId: opts.liveClassId,
    });
  }

  return sendInteraktTemplateMessage({
    countryCode: parsed.countryCode,
    phoneNumber: parsed.phoneNumber,
    callbackData: `live-class-${opts.liveClassId}`,
    bodyValues: [
      formatStudentGreeting(opts.studentName),
      opts.classTitle.trim(),
      opts.courseName.trim(),
      batchLabel,
      scheduledLabel,
    ],
    buttonValues: {
      "0": [linkButton],
    },
  });
}

/** Super-admin diagnostic: track contact then send a test template message. */
export async function testInteraktDelivery(opts: {
  phone: string;
  studentName?: string;
}): Promise<{
  configured: boolean;
  track: InteraktSendResult;
  send: InteraktSendResult;
}> {
  const configured = isInteraktConfigured();
  const parsed = parsePhoneForInterakt(opts.phone);
  if (!parsed) {
    const invalid = { ok: false as const, error: `Invalid phone number: ${opts.phone}` };
    return { configured, track: invalid, send: invalid };
  }

  const name = opts.studentName?.trim() || "Test Student";
  const track = await trackInteraktUser({
    countryCode: parsed.countryCode,
    phoneNumber: parsed.phoneNumber,
    traits: { name },
  });

  const send = await sendInteraktTemplateMessage({
    countryCode: parsed.countryCode,
    phoneNumber: parsed.phoneNumber,
    callbackData: "lms-interakt-test",
    bodyValues: [
      formatStudentGreeting(name),
      "Test Live Class",
      "Test Course",
      "Test Batch",
      formatScheduledAt(new Date()),
    ],
    buttonValues: {
      "0": ["meet.google.com/test-link"],
    },
  });

  return { configured, track, send };
}

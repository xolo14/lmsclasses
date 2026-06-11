import nodemailer from "nodemailer";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "LMS Platform";

export function getDefaultFromEmail(): string {
  const smtpUser = getSmtpUser();
  return (
    process.env.MAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    (smtpUser ? `LMS Classes <${smtpUser}>` : `LMS Classes <info@lmsclasses.com>`)
  );
}

export function getSmtpUser(): string {
  return (process.env.SMTP_USER ?? "").trim();
}

export function getSmtpPass(): string {
  let pass = (process.env.SMTP_PASS ?? "").trim();
  if (
    (pass.startsWith('"') && pass.endsWith('"')) ||
    (pass.startsWith("'") && pass.endsWith("'"))
  ) {
    pass = pass.slice(1, -1);
  }
  return pass;
}

export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST?.trim() && getSmtpUser() && getSmtpPass());
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

export function isEmailConfigured(): boolean {
  return isSmtpConfigured() || isResendConfigured();
}

function getSmtpAttempts(): { port: number; secure: boolean }[] {
  const primaryPort = Number(process.env.SMTP_PORT || 465);
  const primarySecure =
    process.env.SMTP_SECURE === "true" ||
    (process.env.SMTP_SECURE !== "false" && primaryPort === 465);

  const attempts: { port: number; secure: boolean }[] = [
    { port: primaryPort, secure: primarySecure },
    { port: 465, secure: true },
    { port: 587, secure: false },
  ];
  const seen = new Set<string>();
  return attempts.filter(({ port, secure }) => {
    const key = `${port}:${secure}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createSmtpTransport(port: number, secure: boolean) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    secure,
    auth: {
      user: getSmtpUser(),
      pass: getSmtpPass(),
    },
    tls: {
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });
}

let cachedTransport: nodemailer.Transporter | null = null;

export type SendMailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
};

export type DeliverEmailResult = {
  ok: boolean;
  mode: "smtp" | "resend" | "mock";
  error?: string;
  port?: number;
};

export async function deliverEmail(payload: SendMailPayload): Promise<DeliverEmailResult> {
  const to = payload.to.trim().toLowerCase();
  let from = payload.from || getDefaultFromEmail();

  const smtpUser = getSmtpUser();
  const configuredFrom = process.env.MAIL_FROM?.trim() || process.env.SMTP_FROM?.trim() || smtpUser;

  if (isSmtpConfigured() && configuredFrom) {
    const emailRegex = /<([^>]+)>/;
    const customMatch = from.match(emailRegex);
    const displayName = customMatch ? from.split("<")[0].trim() : (from.includes("@") ? "" : from.trim());
    
    const configMatch = configuredFrom.match(emailRegex);
    const configEmail = configMatch ? configMatch[1].trim() : configuredFrom.trim();
    
    from = displayName ? `${displayName} <${configEmail}>` : configEmail;
  }

  let smtpError: string | undefined;
  if (isSmtpConfigured()) {
    let lastError = "SMTP send failed";
    for (const { port, secure } of getSmtpAttempts()) {
      try {
        const transport = createSmtpTransport(port, secure);
        await transport.sendMail({
          from,
          to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        });
        cachedTransport = transport;
        console.log("[Email] Sent via SMTP", { to, port, secure });
        return { ok: true, mode: "smtp", port };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error("[Email] SMTP attempt failed", { port, secure, error: lastError });
        cachedTransport = null;
      }
    }
    smtpError = lastError;
    console.warn("[Email] SMTP failed, trying Resend if configured", { error: smtpError });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);
      const res = await resend.emails.send({
        from,
        to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      if (res.error) {
        throw new Error(res.error.message || "Resend failed to send email");
      }
      console.log("[Email] Sent via Resend", { to });
      return { ok: true, mode: "resend" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        mode: "resend",
        error: smtpError ? `SMTP failed (${smtpError}). Resend failed (${msg}).` : msg,
      };
    }
  }

  console.warn("[Email] Mock — SMTP/Resend not configured", { to, subject: payload.subject });
  return {
    ok: false,
    mode: "mock",
    error:
      smtpError ??
      "Email not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and SMTP_PORT=465, SMTP_SECURE=true) on Hostinger.",
  };
}

export type SmtpVerifyResult = {
  ok: boolean;
  port?: number;
  secure?: boolean;
  error?: string;
};

export async function verifySmtpConnection(): Promise<SmtpVerifyResult> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP not configured" };
  }

  let lastError = "Unknown SMTP error";
  for (const { port, secure } of getSmtpAttempts()) {
    try {
      const transport = createSmtpTransport(port, secure);
      await transport.verify();
      cachedTransport = transport;
      return { ok: true, port, secure };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { ok: false, error: lastError };
}

export { appName };

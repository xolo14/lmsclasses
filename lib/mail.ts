import nodemailer from "nodemailer";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "LMS Platform";

export function getDefaultFromEmail(): string {
  return (
    process.env.MAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `LMS Platform <info@lmsclasses.com>`
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
  });
}

let cachedTransport: nodemailer.Transporter | null = null;

function getSmtpTransport(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    (process.env.SMTP_SECURE !== "false" && port === 465);

  cachedTransport = createSmtpTransport(port, secure);
  return cachedTransport;
}

export type SendMailPayload = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function deliverEmail(payload: SendMailPayload): Promise<"smtp" | "resend" | "mock"> {
  const from = payload.from || getDefaultFromEmail();

  if (isSmtpConfigured()) {
    const transport = getSmtpTransport();
    await transport.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return "smtp";
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    return "resend";
  }

  console.log("[Email] Mock send (configure SMTP or RESEND):", {
    from,
    to: payload.to,
    subject: payload.subject,
  });
  return "mock";
}

export type SmtpVerifyResult = {
  ok: boolean;
  port?: number;
  secure?: boolean;
  error?: string;
};

/** Try configured port, then common Hostinger fallback (587 TLS). */
export async function verifySmtpConnection(): Promise<SmtpVerifyResult> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP not configured" };
  }

  const primaryPort = Number(process.env.SMTP_PORT || 465);
  const primarySecure =
    process.env.SMTP_SECURE === "true" ||
    (process.env.SMTP_SECURE !== "false" && primaryPort === 465);

  const attempts: { port: number; secure: boolean }[] = [
    { port: primaryPort, secure: primarySecure },
  ];
  if (primaryPort !== 587) {
    attempts.push({ port: 587, secure: false });
  }
  if (primaryPort !== 465) {
    attempts.push({ port: 465, secure: true });
  }

  let lastError = "Unknown SMTP error";
  for (const { port, secure } of attempts) {
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

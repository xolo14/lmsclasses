import nodemailer from "nodemailer";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "LMS Platform";

export function getDefaultFromEmail(): string {
  return (
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    `LMS Platform <info@lmsclasses.com>`
  );
}

export function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASS?.trim()
  );
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

export function isEmailConfigured(): boolean {
  return isSmtpConfigured() || isResendConfigured();
}

let cachedTransport: nodemailer.Transporter | null = null;

function getSmtpTransport(): nodemailer.Transporter {
  if (cachedTransport) return cachedTransport;

  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    (process.env.SMTP_SECURE !== "false" && port === 465);

  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

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

/** Verify Hostinger SMTP credentials (optional startup check). */
export async function verifySmtpConnection(): Promise<boolean> {
  if (!isSmtpConfigured()) return false;
  await getSmtpTransport().verify();
  return true;
}

export { appName };

import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull, sql } from "drizzle-orm";
import { useSecureCookies } from "@/lib/auth.config";
import { getAppUrl } from "@/lib/app-url";
import { getUploadsRootDir } from "@/lib/uploads";
import {
  isRazorpayConfigured,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  PAYMENTS_DEPLOY_VERSION,
} from "@/lib/razorpay";
import {
  isEmailConfigured,
  isSmtpConfigured,
  isResendConfigured,
  getDefaultFromEmail,
  getSmtpUser,
  verifySmtpConnection,
  type SmtpVerifyResult,
} from "@/lib/mail";

export const runtime = "nodejs";

const HEALTH_VERSION = "health-v3";

function maskKeyId(keyId: string | null): string | null {
  if (!keyId) return null;
  if (keyId.length <= 12) return "***";
  return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

function collectWarnings(authUrl: string | null, appUrl: string): string[] {
  const warnings: string[] = [];
  if (authUrl?.startsWith("http://") && !authUrl.includes("localhost")) {
    warnings.push(
      "Set NEXTAUTH_URL and AUTH_URL to https://lmsclasses.com (you use HTTP now — login cookies may fail on HTTPS)."
    );
  }
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    warnings.push(
      "Set NEXT_PUBLIC_APP_URL=https://lmsclasses.com in Hostinger (email links use AUTH_URL as fallback for now)."
    );
  }
  if (appUrl.startsWith("http://") && !appUrl.includes("localhost")) {
    warnings.push("App URL should use https://lmsclasses.com for production.");
  }
  return warnings;
}

export async function GET() {
  let dbConnected = false;
  let activeUsers = 0;
  let dbError: string | null = null;

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deletedAt));
    activeUsers = row?.count ?? 0;
    dbConnected = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Database query failed";
  }

  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null;
  const appUrl = getAppUrl();
  const secretSet = !!(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  const warnings = collectWarnings(authUrl, appUrl);

  let smtpConnected = false;
  let smtpError: string | null = null;
  let smtpPort: number | null = null;
  if (isSmtpConfigured()) {
    try {
      const result = await Promise.race<SmtpVerifyResult>([
        verifySmtpConnection(),
        new Promise<SmtpVerifyResult>((resolve) =>
          setTimeout(
            () => resolve({ ok: false, error: "SMTP verify timeout (20s)" }),
            20000
          )
        ),
      ]);
      smtpConnected = result.ok;
      smtpPort = result.port ?? null;
      if (!result.ok) {
        smtpError = result.error ?? "SMTP connection failed";
        const err = smtpError.toLowerCase();
        if (err.includes("timeout")) {
          warnings.push(
            "SMTP verify timed out. Hostinger panel: smtp.hostinger.com port 465 SSL — set SMTP_PORT=465, SMTP_SECURE=true, correct SMTP_PASS, restart app. If still timing out, try SMTP_PORT=587 and SMTP_SECURE=false, or use Resend."
          );
        } else if (err.includes("535") || err.includes("authentication")) {
          warnings.push(
            "SMTP auth failed (535). Reset mailbox password for info@lmsclasses.com in hPanel, set SMTP_USER=info@lmsclasses.com and SMTP_PASS to that password (no quotes)."
          );
        } else {
          warnings.push(
            "SMTP failed. Hostinger: SMTP_HOST=smtp.hostinger.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER=info@lmsclasses.com, valid SMTP_PASS."
          );
        }
      }
    } catch (err) {
      smtpError = err instanceof Error ? err.message : "SMTP connection failed";
      warnings.push("SMTP verify error. Check SMTP_PASS and port 465/587.");
    }
  }

  const razorpayOk = isRazorpayConfigured();

  const uploadsRoot = getUploadsRootDir();
  let uploadsWritable = false;
  let uploadsError: string | null = null;
  try {
    await mkdir(uploadsRoot, { recursive: true });
    await access(uploadsRoot, constants.W_OK);
    uploadsWritable = true;
  } catch (err) {
    uploadsError = err instanceof Error ? err.message : "Uploads directory not writable";
    if (!process.env.UPLOADS_DIR?.trim()) {
      warnings.push(
        "UPLOADS_DIR not set — uploads use ./uploads next to server.js (outside public/). Set UPLOADS_DIR to override."
      );
    } else {
      warnings.push(
        `Uploads directory not writable: ${uploadsRoot}. Create the uploads folder and check permissions (chmod 755).`
      );
    }
  }

  let emailOk = false;
  if (isSmtpConfigured()) {
    emailOk = smtpConnected;
  } else if (isResendConfigured()) {
    emailOk = true;
  } else {
    warnings.push("No email provider configured (set SMTP or RESEND env vars).");
  }

  const coreOk = dbConnected && secretSet && razorpayOk;

  return NextResponse.json({
    ok: coreOk && emailOk,
    coreOk,
    emailOk,
    version: HEALTH_VERSION,
    deployVersion: PAYMENTS_DEPLOY_VERSION,
    warnings,
    database: { connected: dbConnected, activeUsers, error: dbError },
    auth: {
      secretSet,
      url: authUrl,
      appUrl,
      trustHost: true,
      useSecureCookies,
      httpsRecommended: authUrl?.startsWith("https://") ?? false,
    },
    razorpay: {
      configured: razorpayOk,
      mode: getRazorpayKeyId()?.startsWith("rzp_live_") ? "live" : "test",
      keyIdMasked: maskKeyId(getRazorpayKeyId()),
      keySecretSet: !!getRazorpayKeySecret(),
      webhookSecretSet: !!process.env.RAZORPAY_WEBHOOK_SECRET?.trim(),
    },
    email: {
      configured: isEmailConfigured(),
      provider: isSmtpConfigured() ? "smtp" : isResendConfigured() ? "resend" : "none",
      from: getDefaultFromEmail(),
      smtpHost: process.env.SMTP_HOST ?? null,
      smtpUser: getSmtpUser() || null,
      smtpPortConfigured: Number(process.env.SMTP_PORT || 465),
      smtpSecureConfigured: process.env.SMTP_SECURE ?? "(auto)",
      smtpPort,
      smtpConnected: isSmtpConfigured() ? smtpConnected : null,
      smtpError,
    },
    uploads: {
      rootDir: uploadsRoot,
      configured: !!process.env.UPLOADS_DIR?.trim(),
      writable: uploadsWritable,
      error: uploadsError,
      publicUrlExample: `${appUrl}/uploads/course-thumbnails/example.jpg`,
    },
  });
}

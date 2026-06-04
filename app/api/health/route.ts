import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull, sql } from "drizzle-orm";
import { useSecureCookies } from "@/lib/auth.config";
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
  verifySmtpConnection,
} from "@/lib/mail";

export const runtime = "nodejs";

const HEALTH_VERSION = "health-v2";

function maskKeyId(keyId: string | null): string | null {
  if (!keyId) return null;
  if (keyId.length <= 12) return "***";
  return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

function collectWarnings(authUrl: string | null): string[] {
  const warnings: string[] = [];
  if (authUrl?.startsWith("http://")) {
    warnings.push(
      "NEXTAUTH_URL uses http://. If your site uses HTTPS, change to https://lmsclasses.com so login cookies work."
    );
  }
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    warnings.push("NEXT_PUBLIC_APP_URL is not set (email links may be wrong).");
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
  const secretSet = !!(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  const warnings = collectWarnings(authUrl);

  let smtpConnected = false;
  let smtpError: string | null = null;
  if (isSmtpConfigured()) {
    try {
      await Promise.race([
        verifySmtpConnection(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("SMTP verify timeout (5s)")), 5000)
        ),
      ]);
      smtpConnected = true;
    } catch (err) {
      smtpError = err instanceof Error ? err.message : "SMTP connection failed";
      warnings.push(
        "SMTP is configured but Hostinger mail login failed. Check SMTP_PASS and port 465/587."
      );
    }
  }

  const razorpayOk = isRazorpayConfigured();

  let emailOk = false;
  if (isSmtpConfigured()) {
    emailOk = smtpConnected;
  } else if (isResendConfigured()) {
    emailOk = true;
  } else {
    warnings.push("No email provider configured (set SMTP or RESEND env vars).");
  }

  const ok = dbConnected && secretSet && razorpayOk && emailOk;

  return NextResponse.json({
    ok,
    version: HEALTH_VERSION,
    deployVersion: PAYMENTS_DEPLOY_VERSION,
    warnings,
    database: { connected: dbConnected, activeUsers, error: dbError },
    auth: {
      secretSet,
      url: authUrl,
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
      smtpConnected: isSmtpConfigured() ? smtpConnected : null,
      smtpError,
    },
  });
}

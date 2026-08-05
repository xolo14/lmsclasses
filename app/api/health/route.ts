import { access, mkdir } from "fs/promises";
import { constants } from "fs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNull, sql } from "drizzle-orm";
import { useSecureCookies } from "@/lib/auth.config";
import { getAppUrl } from "@/lib/app-url";
import { refreshUploadsRootDir } from "@/lib/uploads";
import { getMetaWhatsAppConfigSummary } from "@/lib/meta-whatsapp";
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
  verifySmtpConnection,
  type SmtpVerifyResult,
} from "@/lib/mail";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasDiagnosticsAccess(request: Request): boolean {
  const secret =
    process.env.HEALTH_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (secret) {
    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const querySecret = new URL(request.url).searchParams.get("secret") ?? "";
    if (bearer === secret || querySecret === secret) return true;
  }
  return false;
}

/** Public probe — no config, paths, keys, or user counts. */
async function publicHealth() {
  let dbOk = false;
  try {
    await db.select({ id: users.id }).from(users).limit(1);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    { ok: dbOk },
    {
      status: dbOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

/** Super-admin / secret-gated diagnostics — never expose raw secrets. */
async function diagnosticsHealth() {
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

  let smtpConnected = false;
  let smtpError: string | null = null;
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
      if (!result.ok) smtpError = result.error ?? "SMTP connection failed";
    } catch (err) {
      smtpError = err instanceof Error ? err.message : "SMTP connection failed";
    }
  }

  const razorpayOk = isRazorpayConfigured();
  const uploadsDiag = await refreshUploadsRootDir();
  let uploadsWritable = false;
  try {
    await mkdir(uploadsDiag.rootDir, { recursive: true });
    await access(uploadsDiag.rootDir, constants.W_OK);
    uploadsWritable = true;
  } catch {
    uploadsWritable = false;
  }

  const emailOk = isSmtpConfigured()
    ? smtpConnected
    : isResendConfigured();

  const whatsapp = getMetaWhatsAppConfigSummary();
  const coreOk = dbConnected && secretSet && razorpayOk;

  return NextResponse.json(
    {
      ok: coreOk && emailOk,
      coreOk,
      emailOk,
      deployVersion: PAYMENTS_DEPLOY_VERSION,
      database: { connected: dbConnected, activeUsers, error: dbError },
      auth: {
        secretSet,
        urlScheme: authUrl?.startsWith("https://")
          ? "https"
          : authUrl?.startsWith("http://")
            ? "http"
            : "unset",
        appUrlScheme: appUrl.startsWith("https://") ? "https" : "http",
        useSecureCookies,
      },
      razorpay: {
        configured: razorpayOk,
        mode: getRazorpayKeyId()?.startsWith("rzp_live_") ? "live" : "test",
        keySecretSet: !!getRazorpayKeySecret(),
        webhookSecretSet: !!process.env.RAZORPAY_WEBHOOK_SECRET?.trim(),
      },
      email: {
        configured: isEmailConfigured(),
        provider: isSmtpConfigured() ? "smtp" : isResendConfigured() ? "resend" : "none",
        smtpConnected: isSmtpConfigured() ? smtpConnected : null,
        smtpError,
      },
      uploads: {
        writable: uploadsWritable,
        configuredViaEnv: uploadsDiag.configuredEnv,
      },
      whatsapp: {
        configured: whatsapp.configured,
        templateName: whatsapp.templateName,
      },
      cron: {
        secretSet: !!process.env.CRON_SECRET?.trim(),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: Request) {
  if (hasDiagnosticsAccess(request)) {
    return diagnosticsHealth();
  }

  const session = await auth();
  if (session?.user?.role === "super_admin") {
    return diagnosticsHealth();
  }

  return publicHealth();
}

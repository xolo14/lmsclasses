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

export const runtime = "nodejs";

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

  return NextResponse.json({
    ok: dbConnected && secretSet,
    deployVersion: PAYMENTS_DEPLOY_VERSION,
    database: { connected: dbConnected, activeUsers, error: dbError },
    auth: {
      secretSet,
      url: authUrl,
      trustHost: true,
      useSecureCookies,
    },
    razorpay: {
      deployVersion: PAYMENTS_DEPLOY_VERSION,
      configured: isRazorpayConfigured(),
      keyIdSet: !!getRazorpayKeyId(),
      keySecretSet: !!getRazorpayKeySecret(),
      checkoutKey: getRazorpayKeyId(),
      webhookSecretSet: !!process.env.RAZORPAY_WEBHOOK_SECRET?.trim(),
    },
  });
}

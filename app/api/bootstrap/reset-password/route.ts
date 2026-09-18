import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getClientIp } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function secretsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** One-time production password reset when BOOTSTRAP_SECRET is set in env. */
export async function POST(request: Request) {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return NextResponse.json({ error: "Not enabled" }, { status: 404 });
  }

  const ip = getClientIp(request) ?? "unknown";
  const limited = checkRateLimit(`bootstrap-reset:${ip}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: { email?: string; newPassword?: string; secret?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const newPassword = body.newPassword ?? "";
  const secret = body.secret ?? "";

  if (!email || !newPassword || !secretsMatch(secret, bootstrapSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedEmail = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (allowedEmail && email !== allowedEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password too short" }, { status: 400 });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role === "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true, email: user.email });
}

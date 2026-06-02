import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, organisations } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { profileSchema, changePasswordSchema } from "@/lib/validations";

export async function GET() {
  const { error, session } = await requireAuth();
  if (error) return error;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      lmsId: users.lmsId,
      collegeName: users.collegeName,
      organisationId: users.organisationId,
      orgName: organisations.name,
      logoUrl: organisations.logoUrl,
    })
    .from(users)
    .leftJoin(organisations, eq(users.organisationId, organisations.id))
    .where(eq(users.id, session!.user.id))
    .limit(1);

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const body = await request.json();

  if (body.currentPassword) {
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid password data" },
        { status: 400 }
      );
    }

    const [user] = await db.select().from(users).where(eq(users.id, session!.user.id)).limit(1);
    const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, session!.user.id));

    await logAction({
      userId: session!.user.id,
      role: session!.user.role,
      action: "CHANGED_PASSWORD",
      entity: "User",
      entityId: session!.user.id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid profile data" },
      { status: 400 }
    );
  }

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (existingEmail && existingEmail.id !== session!.user.id) {
    return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
  }

  const [user] = await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session!.user.id))
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "UPDATED_PROFILE",
    entity: "User",
    entityId: session!.user.id,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(user);
}

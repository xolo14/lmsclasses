/**
 * Reset a user's password in Neon (must match Hostinger DATABASE_URL).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reset-password.ts phani123@gmail.com NewPass@123
 */
import { validateDatabaseUrl } from "../lib/load-env";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const newPassword = process.argv[3] ?? "";

  if (!email || !newPassword) {
    console.error("Usage: npx tsx --env-file=.env.local scripts/reset-password.ts <email> <new-password>");
    process.exit(1);
  }

  validateDatabaseUrl();

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    console.error(`No active user found for: ${email}`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await db
    .update(users)
    .set({ password: hashed, isActive: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const ok = await bcrypt.compare(newPassword, hashed);
  console.log(`Updated ${user.email} (${user.role}). Verify hash: ${ok ? "OK" : "FAILED"}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

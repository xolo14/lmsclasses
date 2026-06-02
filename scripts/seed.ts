import { validateDatabaseUrl } from "../lib/load-env";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  validateDatabaseUrl();

  const hashedPassword = await bcrypt.hash("SuperAdmin@123", 12);

  await db.insert(users).values({
    name: "Super Admin",
    email: "superadmin@lms.com",
    password: hashedPassword,
    role: "super_admin",
  });

  console.log("✅ Super admin seeded: superadmin@lms.com / SuperAdmin@123");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

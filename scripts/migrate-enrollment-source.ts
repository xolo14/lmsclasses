import { db } from "@/lib/db";
import { studentCourses } from "@/lib/db/schema";
import { isNull, isNotNull } from "drizzle-orm";

async function main() {
  await db
    .update(studentCourses)
    .set({ enrollmentSource: "org_admin" })
    .where(isNotNull(studentCourses.organisationId));

  await db
    .update(studentCourses)
    .set({ enrollmentSource: "super_admin" })
    .where(isNull(studentCourses.organisationId));

  console.log("✅ enrollmentSource migration complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

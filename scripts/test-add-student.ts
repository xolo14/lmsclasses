/**
 * Diagnose student creation — run: npm run seed (optional) then:
 * npx tsx --env-file=.env.local scripts/test-add-student.ts
 */
import { validateDatabaseUrl } from "../lib/load-env";
import { db } from "@/lib/db";
import { users, organisations, liveCourses, batches, slots, studentCourses } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { studentSchema } from "@/lib/validations";
import { generateLmsId, generatePassword } from "@/lib/razorpay";

async function main() {
  validateDatabaseUrl();

  const orgs = await db.select().from(organisations).where(isNull(organisations.deletedAt)).limit(3);
  const courseList = await db.select().from(liveCourses).where(isNull(liveCourses.deletedAt)).limit(3);
  console.log("Orgs:", orgs.map((o) => ({ id: o.id, name: o.name })));
  console.log("Courses:", courseList.map((c) => ({ id: c.id, title: c.title })));

  if (!orgs.length || !courseList.length) {
    console.error("Need at least one org and course in DB");
    process.exit(1);
  }

  const orgId = orgs[0].id;
  const courseId = courseList[0].id;
  const batchRows = await db
    .select()
    .from(batches)
    .where(and(eq(batches.courseId, courseId), isNull(batches.deletedAt)))
    .limit(1);

  const testEmail = `test.student.${Date.now()}@example.com`;
  const body = {
    name: "Test Student",
    email: testEmail,
    phone: "",
    lmsId: generateLmsId(),
    password: "",
    collegeName: "",
    courseId,
    batchId: batchRows[0]?.id,
    organisationId: orgId,
  };

  const parsed = studentSchema.safeParse(body);
  console.log("Schema parse:", parsed.success ? "OK" : parsed.error.flatten());

  if (!parsed.success) process.exit(1);

  const slotRecords = await db
    .select()
    .from(slots)
    .where(and(eq(slots.organisationId, orgId), eq(slots.courseId, courseId)));
  console.log("Slots:", slotRecords);

  try {
    const hashed = await bcrypt.hash(generatePassword(), 12);
    const [student] = await db
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        password: hashed,
        role: "student",
        lmsId: body.lmsId,
        collegeName: body.collegeName || null,
        organisationId: orgId,
      })
      .returning();
    console.log("User inserted:", student.id);

    await db.insert(studentCourses).values({
      studentId: student.id,
      liveCourseId: courseId,
      recordCourseId: null,
      batchId: body.batchId || null,
      organisationId: orgId,
    });
    console.log("student_courses inserted OK");

    // cleanup
    await db.delete(studentCourses).where(eq(studentCourses.studentId, student.id));
    await db.delete(users).where(eq(users.id, student.id));
    console.log("Cleanup done — DB insert path works");
  } catch (e) {
    console.error("Insert failed:", e);
    process.exit(1);
  }
}

main();

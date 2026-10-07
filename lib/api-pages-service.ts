import bcrypt from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  batches,
  classRecordings,
  issuedCertificates,
  liveClasses,
  liveCourses,
  recordCourses,
  users,
  widgetLeads,
} from "@/lib/db/schema";
import type { ApiPageId } from "@/lib/api-key-types";
import {
  batchSchema,
  classRecordingSchema,
  courseSchema,
  liveClassSchema,
  mentorSchema,
  recordCourseSchema,
} from "@/lib/validations";
import { DirectStudentSchema } from "@/lib/validations/super-admin-student";
import { ensureUniqueLiveCourseSlug, ensureUniqueRecordCourseSlug } from "@/lib/slug";

export class PagesApiError extends Error {
  status: number;
  fields?: Record<string, unknown>;
  constructor(message: string, status = 400, fields?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function omitSecret<T extends { password?: string | null }>(row: T) {
  const { password: _omit, ...rest } = row;
  return rest;
}

async function listStudents() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      lmsId: users.lmsId,
      collegeName: users.collegeName,
      organisationId: users.organisationId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.role, "student"), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt))
    .limit(200);
  return rows;
}

async function getStudent(id: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      lmsId: users.lmsId,
      collegeName: users.collegeName,
      organisationId: users.organisationId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "student"), isNull(users.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Student not found", 404);
  return row;
}

async function createStudent(body: unknown) {
  const parsed = DirectStudentSchema.safeParse(
    body && typeof body === "object" ? { ...body, directEnrollment: true } : body
  );
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  if (existing) throw new PagesApiError("Email already registered", 409);
  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const [student] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      password: hashed,
      role: "student",
      collegeName: parsed.data.collegeName ?? null,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      lmsId: users.lmsId,
    });
  return student;
}

async function updateStudent(id: string, body: Record<string, unknown>) {
  await getStudent(id);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase();
  if (typeof body.phone === "string") patch.phone = body.phone;
  if (typeof body.collegeName === "string") patch.collegeName = body.collegeName;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  await db.update(users).set(patch).where(eq(users.id, id));
  return getStudent(id);
}

async function deleteStudent(id: string) {
  await getStudent(id);
  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id));
  return { success: true };
}

async function listLiveCourses() {
  return db
    .select()
    .from(liveCourses)
    .where(isNull(liveCourses.deletedAt))
    .orderBy(desc(liveCourses.createdAt))
    .limit(200);
}

async function getLiveCourse(id: string) {
  const [row] = await db
    .select()
    .from(liveCourses)
    .where(and(eq(liveCourses.id, id), isNull(liveCourses.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Live course not found", 404);
  return row;
}

async function createLiveCourse(body: unknown) {
  const parsed = courseSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const slug = await ensureUniqueLiveCourseSlug(parsed.data.title);
  const [row] = await db
    .insert(liveCourses)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price.toString(),
      demoUrl: parsed.data.demoUrl,
      duration: parsed.data.duration,
      slug,
    })
    .returning();
  return row;
}

async function updateLiveCourse(id: string, body: Record<string, unknown>) {
  await getLiveCourse(id);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (body.price != null) patch.price = String(body.price);
  if (typeof body.demoUrl === "string") patch.demoUrl = body.demoUrl;
  if (typeof body.duration === "string") patch.duration = body.duration;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  await db.update(liveCourses).set(patch).where(eq(liveCourses.id, id));
  return getLiveCourse(id);
}

async function deleteLiveCourse(id: string) {
  await getLiveCourse(id);
  await db
    .update(liveCourses)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(liveCourses.id, id));
  return { success: true };
}

async function listRecordCourses() {
  return db
    .select()
    .from(recordCourses)
    .where(isNull(recordCourses.deletedAt))
    .orderBy(desc(recordCourses.createdAt))
    .limit(200);
}

async function getRecordCourse(id: string) {
  const [row] = await db
    .select()
    .from(recordCourses)
    .where(and(eq(recordCourses.id, id), isNull(recordCourses.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Record course not found", 404);
  return row;
}

async function createRecordCourse(body: unknown) {
  const parsed = recordCourseSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const slug = await ensureUniqueRecordCourseSlug(parsed.data.title);
  const [row] = await db
    .insert(recordCourses)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price.toString(),
      demoUrl: parsed.data.demoUrl,
      duration: parsed.data.duration,
      thumbnailUrl: parsed.data.thumbnailUrl || null,
      slug,
    })
    .returning();
  return row;
}

async function updateRecordCourse(id: string, body: Record<string, unknown>) {
  await getRecordCourse(id);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (body.price != null) patch.price = String(body.price);
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  await db.update(recordCourses).set(patch).where(eq(recordCourses.id, id));
  return getRecordCourse(id);
}

async function deleteRecordCourse(id: string) {
  await getRecordCourse(id);
  await db
    .update(recordCourses)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(recordCourses.id, id));
  return { success: true };
}

async function listBatches() {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      courseId: batches.courseId,
      courseTitle: liveCourses.title,
      organisationId: batches.organisationId,
      startDate: batches.startDate,
      endDate: batches.endDate,
      maxSlots: batches.maxSlots,
      createdAt: batches.createdAt,
    })
    .from(batches)
    .leftJoin(liveCourses, eq(batches.courseId, liveCourses.id))
    .where(isNull(batches.deletedAt))
    .orderBy(desc(batches.createdAt))
    .limit(200);
}

async function getBatch(id: string) {
  const [row] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, id), isNull(batches.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Batch not found", 404);
  return row;
}

async function createBatch(body: unknown) {
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const [row] = await db
    .insert(batches)
    .values({
      name: parsed.data.name,
      courseId: parsed.data.courseId,
      organisationId: parsed.data.organisationId,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      maxSlots: parsed.data.maxSlots,
    })
    .returning();
  return row;
}

async function updateBatch(id: string, body: Record<string, unknown>) {
  await getBatch(id);
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.maxSlots === "number") patch.maxSlots = body.maxSlots;
  if (typeof body.startDate === "string") patch.startDate = new Date(body.startDate);
  if (typeof body.endDate === "string") patch.endDate = new Date(body.endDate);
  await db.update(batches).set(patch).where(eq(batches.id, id));
  return getBatch(id);
}

async function deleteBatch(id: string) {
  await getBatch(id);
  await db.update(batches).set({ deletedAt: new Date() }).where(eq(batches.id, id));
  return { success: true };
}

async function listMentors() {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "mentor"), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt))
    .limit(200);
  return rows.map(omitSecret);
}

async function getMentor(id: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "mentor"), isNull(users.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Mentor not found", 404);
  return omitSecret(row);
}

async function createMentor(body: unknown) {
  const parsed = mentorSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  if (existing) throw new PagesApiError("Email already registered", 409);
  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const [row] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      password: hashed,
      role: "mentor",
      courseId: parsed.data.courseId || null,
    })
    .returning();
  return omitSecret(row);
}

async function updateMentor(id: string, body: Record<string, unknown>) {
  await getMentor(id);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase();
  if (typeof body.phone === "string") patch.phone = body.phone;
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  await db.update(users).set(patch).where(eq(users.id, id));
  return getMentor(id);
}

async function deleteMentor(id: string) {
  await getMentor(id);
  await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id));
  return { success: true };
}

async function listLiveClasses() {
  return db
    .select({
      id: liveClasses.id,
      title: liveClasses.title,
      courseId: liveClasses.courseId,
      courseTitle: liveCourses.title,
      batchId: liveClasses.batchId,
      mentorId: liveClasses.mentorId,
      scheduledAt: liveClasses.scheduledAt,
      status: liveClasses.status,
      meetingLink: liveClasses.meetingLink,
      duration: liveClasses.duration,
      createdAt: liveClasses.createdAt,
    })
    .from(liveClasses)
    .leftJoin(liveCourses, eq(liveClasses.courseId, liveCourses.id))
    .where(isNull(liveClasses.deletedAt))
    .orderBy(desc(liveClasses.scheduledAt))
    .limit(200);
}

async function getLiveClass(id: string) {
  const [row] = await db
    .select()
    .from(liveClasses)
    .where(and(eq(liveClasses.id, id), isNull(liveClasses.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Live class not found", 404);
  return row;
}

async function createLiveClass(body: unknown) {
  const parsed = liveClassSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const link = (parsed.data.manualMeetLink || parsed.data.meetingLink || "").trim() || null;
  const [row] = await db
    .insert(liveClasses)
    .values({
      title: parsed.data.title,
      courseId: parsed.data.courseId,
      batchId: parsed.data.batchId ?? null,
      mentorId: parsed.data.mentorId,
      hostUserId: parsed.data.hostUserId ?? parsed.data.mentorId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      duration: parsed.data.duration ?? 60,
      status: parsed.data.status ?? "scheduled",
      meetingLink: link,
      meetStatus: link ? "manual" : "not_requested",
    })
    .returning();
  return row;
}

async function updateLiveClass(id: string, body: Record<string, unknown>) {
  await getLiveClass(id);
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.meetingLink === "string") patch.meetingLink = body.meetingLink;
  if (typeof body.scheduledAt === "string") patch.scheduledAt = new Date(body.scheduledAt);
  if (typeof body.duration === "number") patch.duration = body.duration;
  await db.update(liveClasses).set(patch).where(eq(liveClasses.id, id));
  return getLiveClass(id);
}

async function deleteLiveClass(id: string) {
  await getLiveClass(id);
  await db.update(liveClasses).set({ deletedAt: new Date() }).where(eq(liveClasses.id, id));
  return { success: true };
}

async function listRecordings() {
  return db
    .select()
    .from(classRecordings)
    .where(isNull(classRecordings.deletedAt))
    .orderBy(desc(classRecordings.createdAt))
    .limit(200);
}

async function getRecording(id: string) {
  const [row] = await db
    .select()
    .from(classRecordings)
    .where(and(eq(classRecordings.id, id), isNull(classRecordings.deletedAt)))
    .limit(1);
  if (!row) throw new PagesApiError("Recording not found", 404);
  return row;
}

async function createRecording(body: unknown) {
  const parsed = classRecordingSchema.safeParse(body);
  if (!parsed.success) throw new PagesApiError("Validation failed", 422, parsed.error.flatten());
  const [row] = await db
    .insert(classRecordings)
    .values({
      courseId: parsed.data.courseId,
      batchId: parsed.data.batchId,
      weekName: parsed.data.weekName,
      topicName: parsed.data.topicName,
      videoUrl: parsed.data.videoUrl,
    })
    .returning();
  return row;
}

async function updateRecording(id: string, body: Record<string, unknown>) {
  await getRecording(id);
  const patch: Record<string, unknown> = {};
  if (typeof body.weekName === "string") patch.weekName = body.weekName;
  if (typeof body.topicName === "string") patch.topicName = body.topicName;
  if (typeof body.videoUrl === "string") patch.videoUrl = body.videoUrl;
  await db.update(classRecordings).set(patch).where(eq(classRecordings.id, id));
  return getRecording(id);
}

async function deleteRecording(id: string) {
  await getRecording(id);
  await db.update(classRecordings).set({ deletedAt: new Date() }).where(eq(classRecordings.id, id));
  return { success: true };
}

async function listLeads() {
  return db.select().from(widgetLeads).orderBy(desc(widgetLeads.createdAt)).limit(200);
}

async function getLead(id: string) {
  const [row] = await db.select().from(widgetLeads).where(eq(widgetLeads.id, id)).limit(1);
  if (!row) throw new PagesApiError("Lead not found", 404);
  return row;
}

async function createLead(body: Record<string, unknown>, ctx?: PagesWriteContext) {
  if (!ctx) throw new PagesApiError("API key context missing", 500);
  const fullName = typeof body.fullName === "string" ? body.fullName : typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const courseId = typeof body.courseId === "string" ? body.courseId : "";
  if (!fullName || !email || !phone || !courseId) {
    throw new PagesApiError("fullName, email, phone, and courseId are required", 422);
  }
  const [course] = await db
    .select({ title: recordCourses.title })
    .from(recordCourses)
    .where(eq(recordCourses.id, courseId))
    .limit(1);
  if (!course) throw new PagesApiError("Course not found", 404);
  const [row] = await db
    .insert(widgetLeads)
    .values({
      apiKeyId: ctx.apiKeyId,
      apiKeyName: ctx.apiKeyName,
      courseId,
      courseName: course.title,
      fullName,
      email,
      phone,
    })
    .returning();
  return row;
}

async function updateLead(id: string, body: Record<string, unknown>) {
  await getLead(id);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.paymentStatus === "string") patch.paymentStatus = body.paymentStatus;
  if (typeof body.name === "string" || typeof body.fullName === "string") {
    patch.fullName = typeof body.fullName === "string" ? body.fullName : body.name;
  }
  if (typeof body.phone === "string") patch.phone = body.phone;
  await db.update(widgetLeads).set(patch).where(eq(widgetLeads.id, id));
  return getLead(id);
}

async function deleteLead(id: string) {
  await getLead(id);
  await db.delete(widgetLeads).where(eq(widgetLeads.id, id));
  return { success: true };
}

async function listCertificates() {
  return db
    .select({
      id: issuedCertificates.id,
      certificateNumber: issuedCertificates.certificateNumber,
      studentId: issuedCertificates.studentId,
      studentName: issuedCertificates.studentNameSnapshot,
      courseName: issuedCertificates.courseNameSnapshot,
      isRevoked: issuedCertificates.isRevoked,
      issuedAt: issuedCertificates.issuedAt,
    })
    .from(issuedCertificates)
    .orderBy(desc(issuedCertificates.issuedAt))
    .limit(200);
}

async function getCertificate(id: string) {
  const [row] = await db
    .select()
    .from(issuedCertificates)
    .where(eq(issuedCertificates.id, id))
    .limit(1);
  if (!row) throw new PagesApiError("Certificate not found", 404);
  const { pdfData: _omit, ...safe } = row;
  return safe;
}

async function createCertificate() {
  throw new PagesApiError(
    "Issue certificates from the LMS Certificates page. This API can list, update, and revoke.",
    400
  );
}

async function updateCertificate(id: string, body: Record<string, unknown>) {
  await getCertificate(id);
  const patch: Record<string, unknown> = {};
  if (body.isRevoked === true) {
    patch.isRevoked = true;
    patch.revokedAt = new Date();
    if (typeof body.revokeReason === "string") patch.revokeReason = body.revokeReason;
  }
  if (body.isRevoked === false) {
    patch.isRevoked = false;
    patch.revokedAt = null;
    patch.revokeReason = null;
  }
  await db.update(issuedCertificates).set(patch).where(eq(issuedCertificates.id, id));
  return getCertificate(id);
}

async function deleteCertificate(id: string) {
  await getCertificate(id);
  await db
    .update(issuedCertificates)
    .set({ isRevoked: true, revokedAt: new Date(), revokeReason: "Deleted via pages API" })
    .where(eq(issuedCertificates.id, id));
  return { success: true };
}

export type PagesWriteContext = { apiKeyId: string; apiKeyName: string };

const handlers: Record<
  ApiPageId,
  {
    list: () => Promise<unknown>;
    get: (id: string) => Promise<unknown>;
    create: (body: unknown, ctx?: PagesWriteContext) => Promise<unknown>;
    update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  }
> = {
  students: { list: listStudents, get: getStudent, create: createStudent, update: updateStudent, remove: deleteStudent },
  "live-courses": { list: listLiveCourses, get: getLiveCourse, create: createLiveCourse, update: updateLiveCourse, remove: deleteLiveCourse },
  "record-courses": { list: listRecordCourses, get: getRecordCourse, create: createRecordCourse, update: updateRecordCourse, remove: deleteRecordCourse },
  batches: { list: listBatches, get: getBatch, create: createBatch, update: updateBatch, remove: deleteBatch },
  mentors: { list: listMentors, get: getMentor, create: createMentor, update: updateMentor, remove: deleteMentor },
  "live-classes": { list: listLiveClasses, get: getLiveClass, create: createLiveClass, update: updateLiveClass, remove: deleteLiveClass },
  "live-recordings": { list: listRecordings, get: getRecording, create: createRecording, update: updateRecording, remove: deleteRecording },
  leads: { list: listLeads, get: getLead, create: createLead, update: updateLead, remove: deleteLead },
  certificates: { list: listCertificates, get: getCertificate, create: createCertificate, update: updateCertificate, remove: deleteCertificate },
};

export async function listPage(page: ApiPageId) {
  return handlers[page].list();
}

export async function getPageItem(page: ApiPageId, id: string) {
  return handlers[page].get(id);
}

export async function createPageItem(page: ApiPageId, body: unknown, ctx?: PagesWriteContext) {
  return handlers[page].create(body, ctx);
}

export async function updatePageItem(page: ApiPageId, id: string, body: Record<string, unknown>) {
  return handlers[page].update(id, body);
}

export async function deletePageItem(page: ApiPageId, id: string) {
  return handlers[page].remove(id);
}


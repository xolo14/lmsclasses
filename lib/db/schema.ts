import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  pgEnum,
  decimal,
  jsonb,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "super_admin",
  "org_admin",
  "manager",
  "mentor",
  "student",
  "hr",
]);

export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "success",
  "failed",
  "refunded",
]);

export const liveClassStatusEnum = pgEnum("live_class_status", [
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "verified",
  "failed",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "internship",
  "full_time",
  "part_time",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "active",
  "closed",
  "archived",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "shortlisted",
  "rejected",
]);

export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  adminId: uuid("admin_id"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  jobPortalAccess: boolean("job_portal_access").default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  password: text("password").notNull(),
  role: roleEnum("role").notNull(),
  lmsId: text("lms_id").unique(),
  collegeName: text("college_name"),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  isActive: boolean("is_active").default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  demoUrl: text("demo_url"),
  isActive: boolean("is_active").default(true),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  maxSlots: integer("max_slots").default(30),
  createdBy: uuid("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountType: discountTypeEnum("discount_type").notNull().default("percent"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0.00"),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").default(0),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  isActive: boolean("is_active").default(true),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .references(() => organisations.id)
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  adminId: uuid("admin_id")
    .references(() => users.id)
    .notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  slotsCount: integer("slots_count").notNull(),
  couponId: uuid("coupon_id").references(() => coupons.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  status: paymentStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const slots = pgTable("slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .references(() => organisations.id)
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  totalSlots: integer("total_slots").notNull(),
  usedSlots: integer("used_slots").default(0),
  paymentId: uuid("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studentCourses = pgTable("student_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .references(() => users.id)
    .notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  enrolledAt: timestamp("enrolled_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const liveClasses = pgTable("live_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  batchId: uuid("batch_id").references(() => batches.id),
  mentorId: uuid("mentor_id")
    .references(() => users.id)
    .notNull(),
  meetingLink: text("meeting_link"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration_minutes"),
  recordingUrl: text("recording_url"),
  status: liveClassStatusEnum("status").default("scheduled"),
  createdBy: uuid("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const classRecordings = pgTable("class_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .references(() => courses.id)
    .notNull(),
  batchId: uuid("batch_id")
    .references(() => batches.id)
    .notNull(),
  weekName: text("week_name").notNull(),
  topicName: text("topic_name").notNull(),
  videoUrl: text("video_url").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  role: roleEnum("role"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  website: text("website"),
  domain: text("domain").notNull(),
  registrationDetails: jsonb("registration_details"),
  verificationStatus: verificationStatusEnum("verification_status").default("verified"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hrUsers = pgTable("hr_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("hr"),
  designation: text("designation"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hrEmailVerifications = pgTable("hr_email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobPostings = pgTable("job_postings", {
  id: uuid("id").primaryKey().defaultRandom(),
  hrId: uuid("hr_id")
    .references(() => hrUsers.id)
    .notNull(),
  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),
  title: text("title").notNull(),
  organisationName: text("organisation_name").notNull(),
  location: text("location"),
  employmentType: employmentTypeEnum("employment_type").notNull(),
  stipend: text("stipend"),
  salary: text("salary"),
  ctc: text("ctc"),
  experienceRequired: text("experience_required"),
  description: text("description").notNull(),
  responsibilities: text("responsibilities"),
  requiredSkills: text("required_skills"),
  eligibilityCriteria: text("eligibility_criteria"),
  lastDateToApply: timestamp("last_date_to_apply"),
  applicationDeadline: timestamp("application_deadline").notNull(),
  openings: integer("openings").default(1),
  status: jobStatusEnum("status").default("active"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jobApplications = pgTable("job_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => jobPostings.id)
    .notNull(),
  studentId: uuid("student_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  collegeName: text("college_name").notNull(),
  yearOfStudy: text("year_of_study").notNull(),
  passedOutYear: text("passed_out_year").notNull(),
  resumeUrl: text("resume_url").notNull(),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  status: applicationStatusEnum("status").default("pending"),
  appliedAt: timestamp("applied_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Slot = typeof slots.$inferSelect;
export type StudentCourse = typeof studentCourses.$inferSelect;
export type LiveClass = typeof liveClasses.$inferSelect;
export type ClassRecording = typeof classRecordings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type HrUser = typeof hrUsers.$inferSelect;
export type HrEmailVerification = typeof hrEmailVerifications.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;
export type JobApplication = typeof jobApplications.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];

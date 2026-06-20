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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** JSON shape for live_schedule on courses */
export type LiveScheduleJson = {
  batchName?: string;
  startDate?: string;
  endDate?: string;
  days?: ("Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun")[];
  timeIST?: string;
  mentorId?: string;
  meetLink?: string;
  totalSessions?: number;
};

/** JSON shape for recorded_modules on courses */
export type RecordedModuleJson = {
  index: number;
  title: string;
  description?: string;
  videoUrl: string;
  durationSeconds: number;
  isPreview?: boolean;
  resources?: { name: string; url: string; type: "pdf" | "zip" | "link" }[];
  releasedAt?: string;
};

export type EnrollmentAccessType = "live" | "recorded" | "both";
export type EnrollmentStatus = "active" | "paused" | "revoked" | "expired" | "completed";

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

export const courseTypeEnum = pgEnum("course_type", ["live", "record"]);

export const enrollmentAccessTypeEnum = pgEnum("enrollment_access_type", [
  "live",
  "recorded",
  "both",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "paused",
  "revoked",
  "expired",
  "completed",
]);

export const partnerLeadStatusEnum = pgEnum("partner_lead_status", [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "enrolled",
  "lost",
]);

export const partnerLeadPaymentStatusEnum = pgEnum("partner_lead_payment_status", [
  "pending",
  "initiated",
  "completed",
  "failed",
  "refunded",
]);

export const widgetLeadPaymentStatusEnum = pgEnum("widget_lead_payment_status", [
  "initiated",
  "completed",
  "failed",
  "cancelled",
]);

export const widgetLeadStatusEnum = pgEnum("widget_lead_status", [
  "new",
  "contacted",
  "follow_up",
  "converted",
  "lost",
]);

export const widgetEventTypeEnum = pgEnum("widget_event_type", [
  "widget_loaded",
  "form_viewed",
  "form_submitted",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "payment_cancelled",
  "payment_link_resent",
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
}, (table) => [
  // PERF: Login query filters by email — without this index, every login is a full table scan
  index("users_email_idx").on(table.email),
  // PERF: Portal queries filter students by org — used on every org admin dashboard load
  index("users_org_id_idx").on(table.organisationId),
  // PERF: Role-based queries used in middleware and admin pages
  index("users_role_idx").on(table.role),
]);

export const liveCourses = pgTable("live_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: text("duration"),
  demoUrl: text("demo_url"),
  demoVideoUrl: text("demo_video_url"),
  thumbnailUrl: text("thumbnail_url"),
  syllabus: jsonb("syllabus"),
  whatYouLearn: jsonb("what_you_learn"),
  requirements: jsonb("requirements"),
  level: text("level").default("Beginner"),
  language: text("language").default("English"),
  totalHours: integer("total_hours"),
  totalLectures: integer("total_lectures"),
  certificate: boolean("certificate").default(true),
  hasLive: boolean("has_live").notNull().default(true),
  hasRecorded: boolean("has_recorded").notNull().default(false),
  liveSchedule: jsonb("live_schedule").$type<LiveScheduleJson>(),
  recordedModules: jsonb("recorded_modules").$type<RecordedModuleJson[]>(),
  totalModules: integer("total_modules").default(0),
  totalLiveHours: integer("total_live_hours").default(0),
  isFeatured: boolean("is_featured").default(false),
  isActive: boolean("is_active").default(true),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recordCourses = pgTable("record_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").unique(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: text("duration"),
  demoUrl: text("demo_url"),
  demoVideoUrl: text("demo_video_url"),
  thumbnailUrl: text("thumbnail_url"),
  syllabus: jsonb("syllabus"),
  whatYouLearn: jsonb("what_you_learn"),
  requirements: jsonb("requirements"),
  level: text("level").default("Beginner"),
  language: text("language").default("English"),
  totalHours: integer("total_hours"),
  totalLectures: integer("total_lectures"),
  certificate: boolean("certificate").default(true),
  hasLive: boolean("has_live").notNull().default(false),
  hasRecorded: boolean("has_recorded").notNull().default(true),
  liveSchedule: jsonb("live_schedule").$type<LiveScheduleJson>(),
  recordedModules: jsonb("recorded_modules").$type<RecordedModuleJson[]>(),
  totalModules: integer("total_modules").default(0),
  totalLiveHours: integer("total_live_hours").default(0),
  isFeatured: boolean("is_featured").default(false),
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
    .references(() => liveCourses.id)
    .notNull(),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  maxSlots: integer("max_slots").default(30),
  createdBy: uuid("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // PERF: "show batches for this course" — dropdown population
  index("batch_course_id_idx").on(table.courseId),
  // PERF: "show batches for this org"
  index("batch_org_id_idx").on(table.organisationId),
]);

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
  // null = direct/public enrollment purchase (no organisation)
  organisationId: uuid("organisation_id").references(() => organisations.id),
  liveCourseId: uuid("live_course_id").references(() => liveCourses.id),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  adminId: uuid("admin_id").references(() => users.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  slotsCount: integer("slots_count").notNull(),
  couponId: uuid("coupon_id").references(() => coupons.id),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  invoiceUrl: text("invoice_url"),
  status: paymentStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // PERF: Org admin history page — "show me my payments"
  index("pay_org_id_idx").on(table.organisationId),
  // PERF: Super admin payments page — "show all payments sorted by date"
  index("pay_created_at_idx").on(table.createdAt),
]);

export const slots = pgTable("slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .references(() => organisations.id)
    .notNull(),
  courseId: uuid("course_id").references(() => liveCourses.id),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  totalSlots: integer("total_slots").notNull(),
  usedSlots: integer("used_slots").default(0),
  paymentId: uuid("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // PERF: Slot check on every student add — must be instant
  index("slots_org_course_idx").on(table.organisationId, table.courseId),
  index("slots_org_record_course_idx").on(table.organisationId, table.recordCourseId),
]);

export const studentCourses = pgTable("student_courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  liveCourseId: uuid("live_course_id").references(() => liveCourses.id),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  batchId: uuid("batch_id").references(() => batches.id),
  organisationId: uuid("organisation_id").references(() => organisations.id),
  assignedBy: uuid("assigned_by").references(() => users.id),
  enrollmentSource: text("enrollment_source").notNull().default("org_admin"),

  accessType: enrollmentAccessTypeEnum("access_type").notNull().default("recorded"),
  liveAccess: boolean("live_access").notNull().default(false),
  liveAccessFrom: timestamp("live_access_from", { withTimezone: true }),
  liveAccessUntil: timestamp("live_access_until", { withTimezone: true }),
  recordedAccess: boolean("recorded_access").notNull().default(true),
  recordedAccessFrom: timestamp("recorded_access_from", { withTimezone: true }),
  recordedAccessUntil: timestamp("recorded_access_until", { withTimezone: true }),

  liveClassesAttended: integer("live_classes_attended").notNull().default(0),
  recordedModulesWatched: integer("recorded_modules_watched").notNull().default(0),
  totalWatchTimeMinutes: integer("total_watch_time_minutes").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  slotConsumed: boolean("slot_consumed").notNull().default(true),
  paymentId: text("payment_id"),
  isFree: boolean("is_free").notNull().default(false),

  status: enrollmentStatusEnum("status").notNull().default("active"),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  pauseReason: text("pause_reason"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokeReason: text("revoke_reason"),

  adminNotes: text("admin_notes"),
  certificate: boolean("certificate").notNull().default(false),
  certificateIssuedAt: timestamp("certificate_issued_at", { withTimezone: true }),

  enrolledAt: timestamp("enrolled_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sc_student_id_idx").on(table.studentId),
  index("sc_batch_id_idx").on(table.batchId),
  index("sc_live_course_id_idx").on(table.liveCourseId),
  index("sc_record_course_id_idx").on(table.recordCourseId),
  index("sc_org_id_idx").on(table.organisationId),
  index("sc_status_idx").on(table.status),
  uniqueIndex("sc_student_live_course_uq").on(table.studentId, table.liveCourseId),
  uniqueIndex("sc_student_record_course_uq").on(table.studentId, table.recordCourseId),
]);

export const recordedModuleProgress = pgTable("recorded_module_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => studentCourses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  liveCourseId: uuid("live_course_id").references(() => liveCourses.id),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  moduleIndex: integer("module_index").notNull(),
  moduleTitle: text("module_title").notNull(),
  watchedSeconds: integer("watched_seconds").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }),
  notes: text("notes"),
}, (table) => [
  uniqueIndex("rmp_enrollment_module_uq").on(table.enrollmentId, table.moduleIndex),
  index("rmp_student_id_idx").on(table.studentId),
]);

export const liveClassAttendance = pgTable("live_class_attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => studentCourses.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id),
  liveCourseId: uuid("live_course_id").references(() => liveCourses.id),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  liveClassId: uuid("live_class_id")
    .notNull()
    .references(() => liveClasses.id),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").default(0),
  wasRecorded: boolean("was_recorded").default(false),
  recordingUrl: text("recording_url"),
}, (table) => [
  uniqueIndex("lca_enrollment_class_uq").on(table.enrollmentId, table.liveClassId),
]);

/** Spec alias — enrollments live in student_courses (live + record course IDs). */
export const studentCourseEnrollments = studentCourses;

/** Course-scoped recordings (base curriculum) — no batchId; distinct from class_recordings */
export const courseRecordings = pgTable("course_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordCourseId: uuid("record_course_id")
    .notNull()
    .references(() => recordCourses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  duration: integer("duration_minutes"),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // PERF: Student curriculum page — "show me recordings for this course"
  index("cr_course_published_idx").on(table.recordCourseId, table.isPublished),
]);

export const liveClasses = pgTable("live_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  courseId: uuid("course_id")
    .references(() => liveCourses.id)
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
}, (table) => [
  // PERF: Mentor portal — "show me my classes" — runs on every mentor page load
  index("lc_mentor_id_idx").on(table.mentorId),
  // PERF: Student portal — "show me classes for my batch"
  index("lc_batch_id_idx").on(table.batchId),
  // PERF: Composite — status filter + batch — used by student live class tab
  index("lc_batch_status_idx").on(table.batchId, table.status),
]);

export const classRecordings = pgTable("class_recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .references(() => liveCourses.id)
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
}, (table) => [
  // PERF: "show me class recordings for this course/batch"
  index("clr_course_id_idx").on(table.courseId),
  index("clr_batch_id_idx").on(table.batchId),
]);

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
}, (table) => [
  // PERF: Audit log page always filters by date DESC — without this, full table scan
  index("al_created_at_idx").on(table.createdAt),
  // PERF: "show me actions by this user" — used in org detail page
  index("al_user_id_idx").on(table.userId),
]);

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

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const courseLeads = pgTable("course_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  courseSlug: text("course_slug").notNull(),
  courseTitle: text("course_title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("course_leads_created_at_idx").on(table.createdAt),
]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  courseId: uuid("course_id").references(() => recordCourses.id),
  allowedCourses: jsonb("allowed_courses").$type<string[]>().notNull().default([]),
  allowedPaymentGateway: text("allowed_payment_gateway").notNull().default("any"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  leadFields: jsonb("lead_fields").$type<{
    required?: string[];
    optional?: string[];
  }>().default({ required: ["name", "email", "phone", "course"], optional: [] }),
  autoCreateStudent: boolean("auto_create_student").default(true).notNull(),
  sendWelcomeEmail: boolean("send_welcome_email").default(true).notNull(),
  notifyWebhook: boolean("notify_webhook").default(false).notNull(),
  rateLimit: jsonb("rate_limit").$type<{ requests: number; windowMinutes: number }>().default({
    requests: 200,
    windowMinutes: 60,
  }),
  ipWhitelist: jsonb("ip_whitelist").$type<string[]>().notNull().default([]),
  environment: text("environment").notNull().default("live"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0).notNull(),
  notes: text("notes"),
  widgetDomainsAllowed: jsonb("widget_domains_allowed").$type<string[]>().default([]),
  redirectOnSuccess: text("redirect_on_success").default("/login"),
  redirectOnFailure: text("redirect_on_failure"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("api_keys_key_hash_idx").on(table.keyHash),
  uniqueIndex("api_keys_key_hash_unique_idx").on(table.keyHash),
  index("api_keys_is_active_idx").on(table.isActive),
  index("api_keys_environment_idx").on(table.environment),
  index("idx_apikey_course").on(table.courseId),
]);

export const partnerLeads = pgTable("partner_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  apiKeyName: text("api_key_name"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city"),
  qualification: text("qualification"),
  workingStatus: text("working_status"),
  preferredBatchTime: text("preferred_batch_time"),
  course: text("course").notNull(),
  courseSlug: text("course_slug"),
  recordCourseId: uuid("record_course_id").references(() => recordCourses.id),
  courseFee: decimal("course_fee", { precision: 10, scale: 2 }),
  source: text("source"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  referralCode: text("referral_code"),
  landingPageUrl: text("landing_page_url"),
  utmParams: jsonb("utm_params").$type<Record<string, string | undefined>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: partnerLeadStatusEnum("status").default("new").notNull(),
  paymentStatus: partnerLeadPaymentStatusEnum("payment_status").default("pending").notNull(),
  paymentId: text("payment_id"),
  paymentOrderId: text("payment_order_id"),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }),
  amountPaidPaise: integer("amount_paid_paise"),
  paymentCurrency: text("payment_currency"),
  paymentGateway: text("payment_gateway"),
  paymentConfirmedAt: timestamp("payment_confirmed_at"),
  studentCreated: boolean("student_created").default(false).notNull(),
  studentId: uuid("student_id").references(() => users.id),
  studentUsername: text("student_username"),
  credentialsSentAt: timestamp("credentials_sent_at"),
  duplicateOf: uuid("duplicate_of"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("partner_leads_email_idx").on(table.email),
  index("partner_leads_status_idx").on(table.status),
  index("partner_leads_payment_status_idx").on(table.paymentStatus),
  index("partner_leads_created_at_idx").on(table.createdAt),
  index("partner_leads_api_key_id_idx").on(table.apiKeyId),
  index("partner_leads_email_course_idx").on(table.email, table.course),
]);

export const apiKeyUsageLogs = pgTable("api_key_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id).notNull(),
  apiKeyName: text("api_key_name"),
  endpoint: text("endpoint").notNull(),
  method: text("method"),
  ipAddress: text("ip_address"),
  requestBody: jsonb("request_body"),
  statusCode: integer("status_code"),
  responseTimeMs: integer("response_time_ms"),
  leadId: uuid("lead_id"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("api_key_usage_logs_key_created_idx").on(table.apiKeyId, table.createdAt),
]);

export const widgetLeads = pgTable("widget_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  apiKeyName: text("api_key_name").notNull(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => recordCourses.id),
  courseName: text("course_name").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  college: text("college"),
  yearOfStudy: text("year_of_study"),
  degree: text("degree"),
  paymentStatus: widgetLeadPaymentStatusEnum("payment_status").default("initiated").notNull(),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  failureReason: text("failure_reason"),
  amountAttempted: integer("amount_attempted"),
  convertedToStudent: boolean("converted_to_student").default(false).notNull(),
  studentId: uuid("student_id").references(() => users.id),
  landingPageUrl: text("landing_page_url"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: widgetLeadStatusEnum("status").default("new").notNull(),
  adminNotes: text("admin_notes"),
  followUpEmailSentAt: timestamp("follow_up_email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_widget_lead_apikey").on(table.apiKeyId),
  index("idx_widget_lead_status").on(table.status),
  index("idx_widget_lead_email").on(table.email),
  index("idx_widget_lead_payment").on(table.paymentStatus),
]);

export const widgetEvents = pgTable("widget_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id")
    .notNull()
    .references(() => apiKeys.id),
  eventType: widgetEventTypeEnum("event_type").notNull(),
  leadId: uuid("lead_id").references(() => widgetLeads.id),
  domain: text("domain"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_widget_event_apikey").on(table.apiKeyId),
  index("idx_widget_event_type").on(table.eventType),
  index("idx_widget_event_created").on(table.createdAt),
]);

export type User = typeof users.$inferSelect;
export type Organisation = typeof organisations.$inferSelect;
export type LiveCourse = typeof liveCourses.$inferSelect;
export type RecordCourse = typeof recordCourses.$inferSelect;
export type Course = LiveCourse | RecordCourse;
export type Batch = typeof batches.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Slot = typeof slots.$inferSelect;
export type StudentCourse = typeof studentCourses.$inferSelect;
export type StudentCourseEnrollment = StudentCourse;
export type RecordedModuleProgress = typeof recordedModuleProgress.$inferSelect;
export type LiveClassAttendance = typeof liveClassAttendance.$inferSelect;
export type LiveClass = typeof liveClasses.$inferSelect;
export type ClassRecording = typeof classRecordings.$inferSelect;
export type CourseRecording = typeof courseRecordings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type HrUser = typeof hrUsers.$inferSelect;
export type HrEmailVerification = typeof hrEmailVerifications.$inferSelect;
export type JobPosting = typeof jobPostings.$inferSelect;
export type JobApplication = typeof jobApplications.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type CourseLead = typeof courseLeads.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type PartnerLead = typeof partnerLeads.$inferSelect;
export type WidgetLead = typeof widgetLeads.$inferSelect;
export type WidgetEvent = typeof widgetEvents.$inferSelect;
export type ApiKeyUsageLog = typeof apiKeyUsageLogs.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];

import { z } from "zod";

/** Form fields often submit "" — treat as missing for optional values. */
function emptyToUndefined(val: unknown) {
  if (val === "" || val === null || val === undefined) return undefined;
  return val;
}

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  demoUrl: z.string().url().optional().or(z.literal("")),
});

export const organisationSchema = z.object({
  orgName: z.string().min(1, "Organisation name is required"),
  adminName: z.string().min(1, "Admin name is required"),
  email: z.string().email("Invalid email"),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  address: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const editOrganisationSchema = z.object({
  orgName: z.string().min(1, "Organisation name is required"),
  adminName: z.string().min(1, "Admin name is required"),
  email: z.string().email("Invalid email"),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  password: z.preprocess(emptyToUndefined, z.string().min(6, "Password must be at least 6 characters").optional()),
  address: z.preprocess(emptyToUndefined, z.string().optional()),
  isActive: z.boolean().optional(),
});

export const managerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const mentorSchema = managerSchema;

export const editManagerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
});

export const batchSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  courseId: z.string().uuid("Select a course"),
  organisationId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxSlots: z.coerce.number().min(1).default(30),
});

export const liveClassSchema = z.object({
  title: z.string().min(1, "Title is required"),
  courseId: z.string().uuid("Select a course"),
  batchId: z.string().uuid().optional(),
  mentorId: z.string().uuid("Select a mentor"),
  meetingLink: z.string().url().optional().or(z.literal("")),
  scheduledAt: z.string().min(1, "Schedule date is required"),
  duration: z.coerce.number().min(15).optional(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).optional(),
  recordingUrl: z.string().url().optional().or(z.literal("")),
});

export const classRecordingSchema = z.object({
  courseId: z.string().uuid("Select a course"),
  batchId: z.string().uuid("Select a batch"),
  weekName: z.string().min(1, "Week name is required"),
  topicName: z.string().min(1, "Topic name is required"),
  videoUrl: z.string().url("Valid video URL is required"),
});

export const studentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  lmsId: z.preprocess(emptyToUndefined, z.string().optional()),
  password: z.preprocess(emptyToUndefined, z.string().optional()),
  collegeName: z.preprocess(emptyToUndefined, z.string().optional()),
  courseId: z.string().uuid("Select a course"),
  batchId: z.string().uuid("Batch is required"),
});

export const buySlotsSchema = z.object({
  courseId: z.string().uuid(),
  slotsCount: z.coerce.number().min(1, "Minimum 1 slot required"),
});

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const hrEmailSchema = z.object({
  email: z.string().email("Enter a valid company email"),
});

export const hrOtpSchema = z.object({
  email: z.string().email("Enter a valid company email"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const hrRegistrationSchema = z
  .object({
    email: z.string().email("Enter a valid company email"),
    companyName: z.string().min(2, "Company name is required"),
    name: z.string().min(2, "HR name is required"),
    designation: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[0-9]/, "Password must include a number")
      .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const hrJobSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  organisationName: z.string().min(2, "Organization name is required"),
  location: z.string().optional(),
  employmentType: z.enum(["internship", "full_time", "part_time"]),
  stipend: z.string().optional(),
  salary: z.string().optional(),
  ctc: z.string().optional(),
  experienceRequired: z.string().optional(),
  description: z.string().min(10, "Description is required"),
  responsibilities: z.string().optional(),
  requiredSkills: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  lastDateToApply: z.string().optional(),
  applicationDeadline: z.string().min(1, "Application deadline is required"),
  openings: z.coerce.number().min(1).default(1),
  active: z.boolean().optional(),
});

export const studentJobApplicationSchema = z.object({
  jobId: z.string().uuid("Invalid job id"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(6, "Phone is required"),
  collegeName: z.string().min(2, "College name is required"),
  yearOfStudy: z.string().min(1, "Current year is required"),
  passedOutYear: z.string().min(4, "Passed out year is required"),
  resumeUrl: z.string().min(5, "Resume URL is required"),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type OrganisationInput = z.infer<typeof organisationSchema>;
export type ManagerInput = z.infer<typeof managerSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
export type LiveClassInput = z.infer<typeof liveClassSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type ClassRecordingInput = z.infer<typeof classRecordingSchema>;
export type HrRegistrationInput = z.infer<typeof hrRegistrationSchema>;
export type HrJobInput = z.infer<typeof hrJobSchema>;
export type StudentJobApplicationInput = z.infer<typeof studentJobApplicationSchema>;

export const couponSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Code can only contain alphanumeric characters, underscores, or hyphens")
    .transform((val) => val.toUpperCase().trim()),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().min(0, "Value must be positive"),
  minOrderAmount: z.coerce.number().min(0, "Min order must be positive").default(0),
  maxUses: z.preprocess(emptyToUndefined, z.coerce.number().min(1, "Max uses must be at least 1").optional()),
  startsAt: z.preprocess(emptyToUndefined, z.string().optional()),
  expiresAt: z.preprocess(emptyToUndefined, z.string().optional()),
  organisationId: z.preprocess(emptyToUndefined, z.string().uuid("Invalid organization ID").optional()),
  isActive: z.boolean().default(true),
});

export type CouponInput = z.infer<typeof couponSchema>;

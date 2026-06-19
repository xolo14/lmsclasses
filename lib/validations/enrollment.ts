import { z } from "zod";

export const accessTypeSchema = z.enum(["live", "recorded", "both"]);

const assignCoursesBaseSchema = z.object({
  studentId: z.string().uuid(),
  courseIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one course")
    .max(10, "Max 10 at a time"),
  accessType: accessTypeSchema,
  batchId: z.string().uuid().optional().nullable(),
  liveAccessFrom: z.coerce.date().optional(),
  liveAccessUntil: z.coerce.date().nullable().optional(),
  recordedAccessFrom: z.coerce.date().optional(),
  recordedAccessUntil: z.coerce.date().nullable().optional(),
  isFree: z.boolean().default(false),
  adminNotes: z.string().max(500).optional(),
});

export const assignCoursesSchema = assignCoursesBaseSchema.refine(
  (data) => {
    if (data.accessType === "live" || data.accessType === "both") {
      return !!data.liveAccessFrom;
    }
    return true;
  },
  { message: "Live access start date required", path: ["liveAccessFrom"] }
);

export const assignCoursesConfigSchema = assignCoursesBaseSchema.omit({
  studentId: true,
  courseIds: true,
});

export const updateEnrollmentSchema = z
  .object({
    accessType: accessTypeSchema.optional(),
    liveAccess: z.boolean().optional(),
    liveAccessFrom: z.coerce.date().optional(),
    liveAccessUntil: z.coerce.date().nullable().optional(),
    recordedAccess: z.boolean().optional(),
    recordedAccessFrom: z.coerce.date().optional(),
    recordedAccessUntil: z.coerce.date().nullable().optional(),
    batchId: z.string().uuid().nullable().optional(),
    status: z.enum(["active", "paused", "revoked"]).optional(),
    pauseReason: z.string().max(200).optional(),
    revokeReason: z.string().min(5).max(500).optional(),
    adminNotes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.status === "revoked" && !data.revokeReason) return false;
      return true;
    },
    { message: "Revoke reason is required", path: ["revokeReason"] }
  );

export const bulkAssignSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(50),
  courseIds: z.array(z.string().uuid()).min(1).max(10),
  config: assignCoursesConfigSchema,
});

export const moduleProgressSchema = z.object({
  enrollmentId: z.string().uuid(),
  moduleIndex: z.number().int().min(0),
  watchedSeconds: z.number().int().min(0),
  isCompleted: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const liveAttendanceSchema = z.object({
  enrollmentId: z.string().uuid(),
  liveClassId: z.string().uuid(),
  joinedAt: z.coerce.date(),
});

export type AssignCoursesInput = z.infer<typeof assignCoursesBaseSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;

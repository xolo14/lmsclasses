import { z } from "zod";
import type { TemplateLayout } from "@/lib/types/certificate";

const baseElementSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  zIndex: z.number(),
  locked: z.boolean(),
});

const textElementSchema = baseElementSchema.extend({
  type: z.literal("text"),
  content: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.enum(["normal", "bold"]),
  fontStyle: z.enum(["normal", "italic"]),
  color: z.string(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]),
  letterSpacing: z.number(),
  lineHeight: z.number().positive(),
});

const imageElementSchema = baseElementSchema.extend({
  type: z.literal("image"),
  src: z.string(),
  objectFit: z.enum(["contain", "cover"]),
  opacity: z.number().min(0).max(1),
  borderRadius: z.number().min(0),
});

const signatureElementSchema = baseElementSchema.extend({
  type: z.literal("signature"),
  label: z.string(),
  signatureType: z.enum(["image", "text"]),
  imageSrc: z.string().optional(),
  signatureText: z.string().optional(),
  signatureFont: z.string().optional(),
  signatureFontSize: z.number().optional(),
  borderBottom: z.boolean(),
  labelFontSize: z.number(),
  labelColor: z.string(),
  signatureColor: z.string().optional(),
});

const dividerElementSchema = baseElementSchema.extend({
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed", "dotted", "ornate"]),
  color: z.string(),
  thickness: z.number().positive(),
});

export const templateElementSchema = z.discriminatedUnion("type", [
  textElementSchema,
  imageElementSchema,
  signatureElementSchema,
  dividerElementSchema,
]);

export const templateLayoutSchema: z.ZodType<TemplateLayout> = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  background: z.object({
    type: z.enum(["color", "gradient", "image"]),
    value: z.string(),
    underlayColor: z.string().optional(),
  }),
  border: z.object({
    show: z.boolean(),
    style: z.enum(["none", "single", "double", "ornate"]),
    color: z.string(),
    width: z.number().min(0),
  }),
  elements: z.array(templateElementSchema),
});

export const templateCourseLinkSchema = z.object({
  courseId: z.string().uuid(),
  courseType: z.enum(["live", "record"]),
});

export const createTemplateSchema = z
  .object({
    name: z.string().min(2).max(100),
    /** Preferred: one or more courses. */
    courses: z.array(templateCourseLinkSchema).max(50).optional(),
    /** Legacy single-course fields (still accepted; merged into courses). */
    courseId: z.string().uuid().optional(),
    courseType: z.enum(["live", "record"]).optional(),
    batchId: z.string().uuid().optional().nullable(),
    layout: templateLayoutSchema,
    autoIssue: z.boolean(),
    isDefault: z.boolean(),
  })
  .superRefine((val, ctx) => {
    const courses = normalizeCoursesInput(val);
    if (val.autoIssue && courses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link at least one course to enable auto-issue",
        path: ["courses"],
      });
    }
    const hasRecord = courses.some((c) => c.courseType === "record");
    const liveCount = courses.filter((c) => c.courseType === "live").length;
    if (val.batchId && (hasRecord || liveCount !== 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Batch filter requires exactly one live course and no recorded courses",
        path: ["batchId"],
      });
    }
  });

export const updateTemplateSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    courses: z.array(templateCourseLinkSchema).max(50).optional(),
    courseId: z.string().uuid().nullable().optional(),
    courseType: z.enum(["live", "record"]).nullable().optional(),
    batchId: z.string().uuid().nullable().optional(),
    layout: templateLayoutSchema.optional(),
    autoIssue: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.courses === undefined && val.courseId === undefined) return;
    const courses = normalizeCoursesInput(val);
    if (val.autoIssue === true && courses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link at least one course to enable auto-issue",
        path: ["courses"],
      });
    }
    if (val.batchId) {
      const hasRecord = courses.some((c) => c.courseType === "record");
      const liveCount = courses.filter((c) => c.courseType === "live").length;
      if (hasRecord || liveCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Batch filter requires exactly one live course and no recorded courses",
          path: ["batchId"],
        });
      }
    }
  });

export function normalizeCoursesInput(input: {
  courses?: { courseId: string; courseType: "live" | "record" }[];
  courseId?: string | null;
  courseType?: "live" | "record" | null;
}): { courseId: string; courseType: "live" | "record" }[] {
  const fromArray = input.courses ?? [];
  const merged = [...fromArray];
  if (input.courseId && input.courseType) {
    if (!merged.some((c) => c.courseId === input.courseId && c.courseType === input.courseType)) {
      merged.unshift({ courseId: input.courseId, courseType: input.courseType });
    }
  }
  const seen = new Set<string>();
  return merged.filter((c) => {
    const key = `${c.courseType}:${c.courseId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const issueCertificateSchema = z.object({
  templateId: z.string().uuid(),
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  courseType: z.enum(["live", "record"]),
  enrollmentId: z.string().uuid().optional(),
});

export const bulkIssueSchema = z.object({
  templateId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1).max(100),
  courseId: z.string().uuid(),
  courseType: z.enum(["live", "record"]),
});

export const revokeCertificateSchema = z.object({
  reason: z.string().min(5).max(500),
});

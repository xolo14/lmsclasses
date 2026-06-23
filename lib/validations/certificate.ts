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
  }),
  border: z.object({
    show: z.boolean(),
    style: z.enum(["none", "single", "double", "ornate"]),
    color: z.string(),
    width: z.number().min(0),
  }),
  elements: z.array(templateElementSchema),
});

export const createTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  courseId: z.string().uuid().optional(),
  courseType: z.enum(["live", "record"]).optional(),
  layout: templateLayoutSchema,
  autoIssue: z.boolean(),
  isDefault: z.boolean(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  courseId: z.string().uuid().nullable().optional(),
  courseType: z.enum(["live", "record"]).nullable().optional(),
  layout: templateLayoutSchema.optional(),
  autoIssue: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

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

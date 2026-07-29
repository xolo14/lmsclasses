import { z } from "zod";
import { API_PERMISSIONS } from "@/lib/api-key-types";

export const createApiKeySchema = z
  .object({
    keyType: z.enum(["widget", "recordings"]).optional().default("widget"),
    name: z.string().min(2).max(120),
    courseId: z.string().uuid().optional(),
    allowedCourses: z.array(z.string().uuid()).optional().default([]),
    permissions: z.array(z.enum(API_PERMISSIONS)).min(1).optional(),
    allowedPaymentGateway: z.enum(["razorpay", "manual", "any"]).optional().default("any"),
    widgetDomainsAllowed: z.array(z.string()).optional().default([]),
    redirectOnSuccess: z
      .string()
      .max(500)
      .optional()
      .default("/login")
      .refine(
        (v) => v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
        { message: "Use a path (/login) or full URL (https://…)" }
      ),
    redirectOnFailure: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z
        .string()
        .max(500)
        .optional()
        .nullable()
        .refine(
          (v) =>
            v == null || v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
          { message: "Use a path or full URL" }
        )
    ),
    expiresAt: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.coerce.date().optional().nullable()
    ),
    webhookUrl: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.string().url().optional().nullable()
    ),
    webhookSecret: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.string().max(120).optional().nullable()
    ),
    leadFields: z
      .object({
        required: z.array(z.string()).optional(),
        optional: z.array(z.string()).optional(),
      })
      .optional(),
    autoCreateStudent: z.boolean().optional().default(true),
    sendWelcomeEmail: z.boolean().optional().default(true),
    notifyWebhook: z.boolean().optional().default(false),
    rateLimit: z
      .object({
        requests: z.number().int().positive().max(10_000),
        windowMinutes: z.number().int().positive().max(1440),
      })
      .optional(),
    ipWhitelist: z.array(z.string()).optional().default([]),
    environment: z.enum(["live", "test"]).optional().default("live"),
    notes: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.string().max(2000).optional().nullable()
    ),
  })
  .superRefine((val, ctx) => {
    if (val.keyType === "recordings") {
      if (!val.allowedCourses || val.allowedCourses.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select at least one record course",
          path: ["allowedCourses"],
        });
      }
    } else if (!val.courseId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a course",
        path: ["courseId"],
      });
    }
  });

export const updateApiKeySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  courseId: z.string().uuid().optional().nullable(),
  permissions: z.array(z.enum(API_PERMISSIONS)).min(1).optional(),
  allowedCourses: z.array(z.string().uuid()).optional(),
  allowedPaymentGateway: z.enum(["razorpay", "manual", "any"]).optional(),
  widgetDomainsAllowed: z.array(z.string()).optional(),
  redirectOnSuccess: z.string().max(500).optional(),
  redirectOnFailure: z.string().max(500).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  webhookUrl: z.string().url().optional().nullable(),
  webhookSecret: z.string().max(120).optional().nullable(),
  leadFields: z
    .object({
      required: z.array(z.string()).optional(),
      optional: z.array(z.string()).optional(),
    })
    .optional(),
  autoCreateStudent: z.boolean().optional(),
  sendWelcomeEmail: z.boolean().optional(),
  notifyWebhook: z.boolean().optional(),
  rateLimit: z
    .object({
      requests: z.number().int().positive().max(10_000),
      windowMinutes: z.number().int().positive().max(1440),
    })
    .optional(),
  ipWhitelist: z.array(z.string()).optional(),
  environment: z.enum(["live", "test"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

import { z } from "zod";
import { API_PERMISSIONS } from "@/lib/api-key-types";

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(120),
  courseId: z.string().uuid({ message: "Select a course" }),
  permissions: z.array(z.enum(API_PERMISSIONS)).min(1).optional(),
  allowedCourses: z.array(z.string()).optional().default([]),
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
        (v) => v == null || v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"),
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
});

export const updateApiKeySchema = createApiKeySchema.partial().omit({ name: true }).extend({
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;

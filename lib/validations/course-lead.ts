import { z } from "zod";

export const courseLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10, "Enter a valid 10-digit phone number"),
  courseSlug: z.string().trim().min(1).max(200),
  courseTitle: z.string().trim().min(1).max(300),
});

export type CourseLeadInput = z.infer<typeof courseLeadSchema>;

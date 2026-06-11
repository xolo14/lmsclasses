import { z } from "zod";

export const DirectStudentSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\d{10}$/, "Phone must be 10 digits"),
    password: z.string().min(8),
    confirmPassword: z.string(),
    collegeName: z.string().min(2),
    courseId: z.string().uuid().optional(),
    batchId: z.string().uuid().optional(),
    directEnrollment: z.literal(true),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((d) => !d.batchId || !!d.courseId, {
    message: "Cannot assign batch without selecting a course",
    path: ["batchId"],
  });

export type DirectStudentInput = z.infer<typeof DirectStudentSchema>;

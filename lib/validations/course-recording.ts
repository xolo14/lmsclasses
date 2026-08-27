import { z } from "zod";
import { videoReferenceSchema } from "@/lib/validations/video-reference";

export const courseRecordingSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().min(1).max(200),
  videoUrl: videoReferenceSchema,
  description: z.string().max(2000).optional(),
  duration: z.coerce.number().int().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isPublished: z.boolean().default(false),
});

export const courseRecordingUpdateSchema = courseRecordingSchema
  .omit({ courseId: true })
  .partial();

export const reorderRecordingsSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

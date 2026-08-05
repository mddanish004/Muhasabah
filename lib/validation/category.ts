import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/, "Use a valid hex color"),
  icon: z.string().trim().min(1),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  isArchived: z.boolean().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;

import { z } from "zod";

export const recurrenceSchema = z.object({
  frequency: z.enum(["DAILY", "WEEKDAYS", "WEEKLY", "MONTHLY", "CUSTOM_INTERVAL"]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  intervalDays: z.number().int().min(1).max(365).optional(),
});

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  categoryId: z.string().min(1),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().nullable(),
  estimatedDurationMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  actualDurationMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  isBackfilled: z.boolean().optional(),
  recurrence: recurrenceSchema.optional(),
});

export const completeTaskSchema = z.object({
  completed: z.boolean(),
  actualDurationMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  completionDate: z.string().date().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

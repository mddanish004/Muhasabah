import { ActivityEventType, Priority, RecurrenceFrequency } from "@prisma/client";

export type TaskWithRelations = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  priority: Priority | null;
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  dueDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  isRecurringTemplate: boolean;
  recurrenceRuleId: string | null;
  isBackfilled: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string;
    isArchived: boolean;
  };
  tags: Array<{
    tag: {
      id: string;
      name: string;
    };
  }>;
  recurrenceRule?: {
    id: string;
    frequency: RecurrenceFrequency;
    daysOfWeek: number[];
    dayOfMonth: number | null;
    intervalDays: number | null;
    isActive: boolean;
  } | null;
};

export type ActivityItem = {
  id: string;
  eventType: ActivityEventType;
  entityId: string;
  entitySnapshot: unknown;
  createdAt: Date;
};

export type AnalyticsFilters = {
  from: Date;
  to: Date;
  timezone: string;
  categoryIds?: string[];
};

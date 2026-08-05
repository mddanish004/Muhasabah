import { ActivityEventType, Prisma, RecurrenceFrequency, type Category, type Task } from "@prisma/client";

import { getAdminConfig } from "@/lib/auth";
import {
  buildAging,
  buildAssignedVsCompleted,
  buildCalendarDay,
  buildCalendarMonth,
  buildCategoryDeepDive,
  buildCompletionRates,
  buildCurrentPeriodTiles,
  buildDashboardData,
  buildDistribution,
  buildPriorityDuration,
  buildRecentActivity,
  buildScores,
  buildStreaks,
  buildTimeComparisons,
  buildTrends,
} from "@/lib/analytics/core";
import { monthBounds, parseDateKey, rangeFromPreset, toEndOfLocalDay, toStartOfLocalDay } from "@/lib/date";
import { db } from "@/lib/db";
import type { TaskWithRelations } from "@/lib/types";
import { slugify } from "@/lib/utils";

const taskInclude = {
  category: true,
  tags: { include: { tag: true } },
  recurrenceRule: true,
} satisfies Prisma.TaskInclude;

export async function getAllCategories(includeArchived = true) {
  const categories = await db.category.findMany({
    where: includeArchived ? undefined : { isArchived: false },
    orderBy: { name: "asc" },
  });
  return categories;
}

export async function getTasks(filters?: {
  from?: Date;
  to?: Date;
  categoryIds?: string[];
  status?: "all" | "incomplete" | "completed";
  priority?: string[];
  search?: string;
}) {
  const where: Prisma.TaskWhereInput = {
    isRecurringTemplate: false,
  };

  if (filters?.from || filters?.to) {
    where.OR = [
      {
        dueDate: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      {
        dueDate: null,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
    ];
  }

  if (filters?.categoryIds?.length) {
    where.categoryId = { in: filters.categoryIds };
  }

  if (filters?.status === "completed") {
    where.completedAt = { not: null };
  }

  if (filters?.status === "incomplete") {
    where.completedAt = null;
  }

  if (filters?.priority?.length) {
    where.priority = { in: filters.priority as never[] };
  }

  if (filters?.search) {
    where.OR = [
      ...(where.OR ?? []),
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: slugify(filters.search), mode: "insensitive" } } } } },
    ];
  }

  return db.task.findMany({
    where,
    include: taskInclude,
    orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  }) as Promise<TaskWithRelations[]>;
}

export async function getTaskById(id: string) {
  return db.task.findUnique({
    where: { id },
    include: taskInclude,
  }) as Promise<TaskWithRelations | null>;
}

export async function getCategoryById(id: string) {
  return db.category.findUnique({ where: { id } });
}

async function connectTags(tx: Prisma.TransactionClient, taskId: string, tags: string[] | undefined) {
  if (!tags) return;
  await tx.taskTag.deleteMany({ where: { taskId } });
  for (const rawTag of tags) {
    const name = slugify(rawTag);
    const tag = await tx.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await tx.taskTag.create({
      data: {
        taskId,
        tagId: tag.id,
      },
    });
  }
}

export async function createTask(data: {
  title: string;
  description?: string | null;
  categoryId: string;
  dueDate?: Date | null;
  priority?: Task["priority"];
  estimatedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  notes?: string | null;
  tags?: string[];
  isBackfilled?: boolean;
  recurrence?: {
    frequency: RecurrenceFrequency;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    intervalDays?: number;
  };
}) {
  return db.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        dueDate: data.dueDate,
        priority: data.priority,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
        actualDurationMinutes: data.actualDurationMinutes,
        notes: data.notes,
        isBackfilled: data.isBackfilled ?? false,
        isRecurringTemplate: Boolean(data.recurrence),
      },
    });

    await connectTags(tx, task.id, data.tags);

    if (data.recurrence) {
      await tx.recurrenceRule.create({
        data: {
          templateTaskId: task.id,
          frequency: data.recurrence.frequency,
          daysOfWeek: data.recurrence.daysOfWeek ?? [],
          dayOfMonth: data.recurrence.dayOfMonth,
          intervalDays: data.recurrence.intervalDays,
        },
      });
    }

    await tx.activityLogEntry.create({
      data: {
        eventType: ActivityEventType.TASK_CREATED,
        entityId: task.id,
        entitySnapshot: task,
      },
    });

    return task;
  });
}

export async function updateTask(id: string, data: Prisma.TaskUpdateInput, tags?: string[]) {
  return db.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id },
      data,
      include: taskInclude,
    });
    await connectTags(tx, id, tags);
    await tx.activityLogEntry.create({
      data: {
        eventType: ActivityEventType.TASK_UPDATED,
        entityId: task.id,
        entitySnapshot: task,
      },
    });
    return task;
  });
}

export async function deleteTask(id: string) {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    if (!task) return null;

    await tx.activityLogEntry.create({
      data: {
        eventType: ActivityEventType.TASK_DELETED,
        entityId: id,
        entitySnapshot: task,
      },
    });
    await tx.task.delete({ where: { id } });
    return task;
  });
}

export async function restoreTask(id: string) {
  const entry = await db.activityLogEntry.findFirst({
    where: { entityId: id, eventType: ActivityEventType.TASK_DELETED },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return null;

  const snapshot = entry.entitySnapshot as Record<string, unknown>;
  const restored = await db.task.create({
    data: {
      id: snapshot.id as string,
      title: snapshot.title as string,
      description: (snapshot.description as string | null) ?? null,
      categoryId: snapshot.categoryId as string,
      priority: (snapshot.priority as Task["priority"]) ?? null,
      estimatedDurationMinutes: (snapshot.estimatedDurationMinutes as number | null) ?? null,
      actualDurationMinutes: (snapshot.actualDurationMinutes as number | null) ?? null,
      dueDate: snapshot.dueDate ? new Date(snapshot.dueDate as string) : null,
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt as string) : null,
      notes: (snapshot.notes as string | null) ?? null,
      isRecurringTemplate: Boolean(snapshot.isRecurringTemplate),
      recurrenceRuleId: (snapshot.recurrenceRuleId as string | null) ?? null,
      isBackfilled: Boolean(snapshot.isBackfilled),
      createdAt: new Date(snapshot.createdAt as string),
      updatedAt: new Date(snapshot.updatedAt as string),
    },
  });

  return restored;
}

export async function createCategory(data: {
  name: string;
  color: string;
  icon: string;
  description?: string | null;
}) {
  const category = await db.category.create({ data });
  await db.activityLogEntry.create({
    data: {
      eventType: ActivityEventType.CATEGORY_CREATED,
      entityId: category.id,
      entitySnapshot: category,
    },
  });
  return category;
}

export async function updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
  const category = await db.category.update({ where: { id }, data });
  await db.activityLogEntry.create({
    data: {
      eventType: ActivityEventType.CATEGORY_UPDATED,
      entityId: category.id,
      entitySnapshot: category,
    },
  });
  return category;
}

export async function deleteCategory(id: string, cascade = false) {
  const taskCount = await db.task.count({ where: { categoryId: id } });
  if (taskCount > 0 && !cascade) {
    return { taskCount, deleted: false as const };
  }

  const result = await db.$transaction(async (tx) => {
    const category = await tx.category.findUnique({ where: { id } });
    if (!category) return null;
    const tasks = await tx.task.findMany({ where: { categoryId: id }, include: taskInclude });
    if (cascade) {
      for (const task of tasks) {
        await tx.activityLogEntry.create({
          data: {
            eventType: ActivityEventType.TASK_DELETED,
            entityId: task.id,
            entitySnapshot: task,
          },
        });
      }
      await tx.task.deleteMany({ where: { categoryId: id } });
    }
    await tx.activityLogEntry.create({
      data: {
        eventType: ActivityEventType.CATEGORY_DELETED,
        entityId: category.id,
        entitySnapshot: category,
      },
    });
    await tx.category.delete({ where: { id } });
    return category;
  });

  return { deleted: true as const, taskCount, category: result };
}

export async function fetchDashboard() {
  const admin = await getAdminConfig();
  const [categories, tasks] = await Promise.all([getAllCategories(true), getTasks()]);
  const dashboard = buildDashboardData(tasks, categories, admin.timezone);
  return {
    ...dashboard,
    recentActivity: buildRecentActivity(tasks),
  };
}

export async function fetchCalendarMonth(year: number, month: number) {
  const admin = await getAdminConfig();
  const categories = await getAllCategories(true);
  const bounds = monthBounds(year, month, admin.timezone);
  const tasks = await getTasks({ from: bounds.from, to: bounds.to });
  return buildCalendarMonth(tasks, categories, bounds.from, bounds.to, admin.timezone);
}

export async function fetchCalendarDay(date: string) {
  const admin = await getAdminConfig();
  const categories = await getAllCategories(true);
  const day = new Date(`${date}T12:00:00`);
  const from = toStartOfLocalDay(day, admin.timezone);
  const to = toEndOfLocalDay(day, admin.timezone);
  const tasks = await getTasks({ from, to });
  return buildCalendarDay(tasks, categories, day, admin.timezone);
}

export async function fetchAnalytics(section: string, range: string, categoryIds?: string[]) {
  const admin = await getAdminConfig();
  const { from, to } = rangeFromPreset(range, admin.timezone);
  const lengthMs = to.getTime() - from.getTime();
  const extendedFrom = new Date(from.getTime() - lengthMs - 1);
  const [categories, tasks] = await Promise.all([getAllCategories(true), getTasks({ from, to, categoryIds })]);

  switch (section) {
    case "completion-rates": {
      const extended = await getTasks({ from: extendedFrom, to, categoryIds });
      const current = buildCurrentPeriodTiles(extended, categories, admin.timezone, admin.weekStartsOn);
      return buildCompletionRates(extended, categories, from, to, admin.timezone, admin.weekStartsOn, current, extendedFrom);
    }
    case "assigned-vs-completed":
      return buildAssignedVsCompleted(tasks, categories, from, to, admin.timezone, admin.weekStartsOn);
    case "trends":
      return buildTrends(tasks, categories, from, to, admin.timezone);
    case "scores": {
      const extended = await getTasks({ from: extendedFrom, to, categoryIds });
      return buildScores(extended, categories, from, to, admin.timezone);
    }
    case "streaks":
      return buildStreaks(tasks, categories, from, to, admin.timezone, admin.weekStartsOn);
    case "categories": {
      const extended = await getTasks({ from: extendedFrom, to, categoryIds });
      return buildCategoryDeepDive(extended, categories, from, to, admin.timezone);
    }
    case "time-comparisons":
      return buildTimeComparisons(tasks, categories, from, to, admin.timezone, admin.weekStartsOn);
    case "distribution":
      return buildDistribution(tasks, categories, from, to, admin.timezone, admin.weekStartsOn);
    case "aging":
      return buildAging(tasks, categories, admin.timezone);
    case "priority-duration":
      return buildPriorityDuration(tasks, categories, admin.timezone);
    default:
      return null;
  }
}

export async function fetchReport(range: string, customFrom?: string, customTo?: string) {
  const admin = await getAdminConfig();
  const { from, to } =
    range === "custom" && customFrom && customTo
      ? {
          from: parseDateKey(customFrom, admin.timezone),
          to: toEndOfLocalDay(parseDateKey(customTo, admin.timezone), admin.timezone),
        }
      : rangeFromPreset(range, admin.timezone);
  const [categories, tasks] = await Promise.all([getAllCategories(true), getTasks({ from, to })]);
  const completionRates = buildCompletionRates(tasks, categories, from, to, admin.timezone);
  const assignedVsCompleted = buildAssignedVsCompleted(tasks, categories, from, to, admin.timezone);
  const streaks = buildStreaks(tasks, categories, from, to, admin.timezone, admin.weekStartsOn);
  const daily = completionRates.daily.filter((day) => day.assigned > 0);
  return {
    summary: {
      totals: completionRates.totals,
      overallCompletionRate: completionRates.overallCompletionRate,
      currentStreak: streaks.currentStreak,
    },
    scores: buildScores(tasks, categories, from, to, admin.timezone),
    trend: completionRates.daily,
    categories: assignedVsCompleted.categories,
    notableDays: {
      best: [...daily]
        .sort((a, b) => b.completionRate - a.completionRate || b.completed - a.completed)
        .slice(0, 3),
      missed: daily
        .filter((day) => day.completed === 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
    },
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: new Date().toISOString(),
    tasks,
  };
}

export async function fetchSettings() {
  const admin = await getAdminConfig();
  return {
    timezone: admin.timezone,
    weekStartsOn: admin.weekStartsOn,
    overloadThreshold: admin.overloadThreshold,
  };
}

export async function exportData() {
  const [admin, categories, tasks, tags, recurrenceRules] = await Promise.all([
    getAdminConfig(),
    db.category.findMany(),
    db.task.findMany({ include: taskInclude }),
    db.tag.findMany(),
    db.recurrenceRule.findMany(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    admin: {
      timezone: admin.timezone,
      weekStartsOn: admin.weekStartsOn,
      overloadThreshold: admin.overloadThreshold,
    },
    categories,
    tasks,
    tags,
    recurrenceRules,
  };
}

export async function importData(payload: {
  categories: Category[];
  tasks: Task[];
  recurrenceRules: Prisma.RecurrenceRuleCreateManyInput[];
}) {
  await db.$transaction(async (tx) => {
    await tx.taskTag.deleteMany();
    await tx.recurrenceRule.deleteMany();
    await tx.task.deleteMany();
    await tx.category.deleteMany();
    await tx.category.createMany({
      data: payload.categories.map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        description: category.description,
        isArchived: category.isArchived,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      })),
    });
    await tx.task.createMany({
      data: payload.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        categoryId: task.categoryId,
        priority: task.priority,
        estimatedDurationMinutes: task.estimatedDurationMinutes,
        actualDurationMinutes: task.actualDurationMinutes,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        notes: task.notes,
        isRecurringTemplate: task.isRecurringTemplate,
        recurrenceRuleId: task.recurrenceRuleId,
        isBackfilled: task.isBackfilled,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    });
    await tx.recurrenceRule.createMany({ data: payload.recurrenceRules });
  });
}

import type { Category } from "@prisma/client";

import {
  buildAging,
  buildCategoryDeepDive,
  buildCompletionRates,
  buildDistribution,
  buildMissedTasks,
  buildPriorityDuration,
  buildScores,
  buildStreaks,
  buildTimeComparisons,
  buildTrends,
} from "@/lib/analytics/core";
import type { TaskWithRelations } from "@/lib/types";

const categories = [
  { id: "cat-1", name: "Work", color: "#5B9EF0", icon: "briefcase", description: null, isArchived: false, createdAt: new Date(), updatedAt: new Date() },
] as Category[];

const tasks = [
  {
    id: "task-1",
    title: "A",
    description: null,
    categoryId: "cat-1",
    priority: "HIGH",
    estimatedDurationMinutes: 30,
    actualDurationMinutes: 25,
    dueDate: new Date("2026-08-03T00:00:00.000Z"),
    completedAt: new Date("2026-08-03T10:00:00.000Z"),
    notes: null,
    isRecurringTemplate: false,
    recurrenceRuleId: null,
    isBackfilled: false,
    createdAt: new Date("2026-08-03T00:00:00.000Z"),
    updatedAt: new Date("2026-08-03T00:00:00.000Z"),
    category: { id: "cat-1", name: "Work", color: "#5B9EF0", icon: "briefcase", isArchived: false },
    tags: [],
  },
  {
    id: "task-2",
    title: "B",
    description: null,
    categoryId: "cat-1",
    priority: "LOW",
    estimatedDurationMinutes: 20,
    actualDurationMinutes: 20,
    dueDate: new Date("2026-08-04T00:00:00.000Z"),
    completedAt: null,
    notes: null,
    isRecurringTemplate: false,
    recurrenceRuleId: null,
    isBackfilled: false,
    createdAt: new Date("2026-08-04T00:00:00.000Z"),
    updatedAt: new Date("2026-08-04T00:00:00.000Z"),
    category: { id: "cat-1", name: "Work", color: "#5B9EF0", icon: "briefcase", isArchived: false },
    tags: [],
  },
] as TaskWithRelations[];

describe("analytics core", () => {
  it("computes completion rate for a range", () => {
    const result = buildCompletionRates(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.overallCompletionRate).toBe(50);
    expect(result.totals.assigned).toBe(2);
    expect(result.totals.completed).toBe(1);
  });

  it("computes transparent score outputs without NaN", () => {
    const result = buildScores(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.productivityScore).toBeGreaterThanOrEqual(0);
    expect(result.consistencyScore).toBeGreaterThanOrEqual(0);
    expect(result.efficiencyScore).not.toBeNaN();
  });

  it("produces streak metadata", () => {
    const streakTasks = [
      ...tasks,
      {
        ...tasks[1],
        id: "task-3",
        dueDate: new Date("2026-08-05T00:00:00.000Z"),
        completedAt: new Date("2026-08-05T08:00:00.000Z"),
      },
    ];

    const result = buildStreaks(
      streakTasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-05T23:59:59.000Z"),
      "UTC",
    );

    expect(result.longestStreak.length).toBeGreaterThanOrEqual(1);
  });

  it("computes an overall-rate delta against the prior period", () => {
    const prior = [
      {
        ...tasks[1],
        id: "task-p1",
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
        completedAt: new Date("2026-08-01T09:00:00.000Z"),
      },
    ];

    const result = buildCompletionRates(
      [...prior, ...tasks],
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
      undefined,
      undefined,
      new Date("2026-08-01T00:00:00.000Z"),
    );

    expect(result.overallRateDelta).toBe(-50);
  });

  it("exposes transparent score inputs and a self-improvement comparison", () => {
    const prior = {
      ...tasks[0],
      id: "task-p1",
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
      completedAt: new Date("2026-08-01T09:00:00.000Z"),
    };

    const result = buildScores(
      [prior, ...tasks],
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.inputs.totalAssigned).toBe(2);
    expect(result.inputs.totalCompleted).toBe(1);
    expect(result.inputs.topCategoryName).toBe("Work");
    expect(result.inputs.completionRate).toBe(50);
    expect(result.inputs.priorCompletionRate).toBe(100);
    expect(result.selfImprovementScore).toBe(0);
  });

  it("produces a 14-point forecast and monotonic cumulative series", () => {
    const result = buildTrends(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.forecast).toHaveLength(14);
    for (const point of result.forecast) {
      expect(point.lower).toBeLessThanOrEqual(point.upper);
      expect(point.value).toBeGreaterThanOrEqual(0);
      expect(point.value).toBeLessThanOrEqual(100);
    }
    expect(result.forecastStd).toBeGreaterThanOrEqual(0);
    let cumulative = 0;
    for (const point of result.cumulative) {
      expect(point.value).toBeGreaterThanOrEqual(cumulative);
      cumulative = point.value;
    }
    expect(result.rollingAverages.r7).toBe(50);
    expect(result.rollingAverages.deltas.r7).toBeNull();

    const longTasks = Array.from({ length: 14 }).map((_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return {
        ...tasks[0],
        id: `task-long-${day}`,
        dueDate: new Date(`2026-07-${day}T00:00:00.000Z`),
        completedAt: new Date(`2026-07-${day}T10:00:00.000Z`),
      };
    });
    const longResult = buildTrends(
      longTasks,
      categories,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-14T23:59:59.000Z"),
      "UTC",
    );
    expect(longResult.rollingAverages.deltas.r7).not.toBeNull();
  });

  it("detects perfect days, streak distribution, and category streaks", () => {
    const streakTasks = [
      ...tasks,
      {
        ...tasks[1],
        id: "task-3",
        dueDate: new Date("2026-08-05T00:00:00.000Z"),
        completedAt: new Date("2026-08-05T08:00:00.000Z"),
      },
    ];

    const result = buildStreaks(
      streakTasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-05T23:59:59.000Z"),
      "UTC",
    );

    expect(result.perfectDays).toBeGreaterThanOrEqual(1);
    expect(result.streakDistribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBeGreaterThanOrEqual(1);
    expect(result.categoryStreaks).toHaveLength(1);
    expect(result.categoryStreaks[0].longest).toBeGreaterThanOrEqual(1);
    expect(result.longestProductivePeriod.length).toBeGreaterThanOrEqual(1);
  });

  it("ranks categories and respects the best/worst sample threshold", () => {
    const result = buildCategoryDeepDive(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.ranking).toHaveLength(1);
    expect(result.ranking[0].categoryName).toBe("Work");
    expect(result.ranking[0].completionRate).toBe(50);
    expect(result.best).toBeNull();
    expect(result.worst).toBeNull();
    expect(result.saturation[0].pct).toBe(100);
  });

  it("builds all four time-comparison periods with deltas", () => {
    const result = buildTimeComparisons(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    for (const period of ["weekly", "monthly", "quarterly", "yearly"] as const) {
      expect(result[period]).toHaveProperty("current");
      expect(result[period]).toHaveProperty("previous");
      expect(result[period].delta).toHaveProperty("rate");
      expect(result[period].delta).toHaveProperty("assigned");
      expect(result[period].delta).toHaveProperty("completed");
    }
  });

  it("counts pending backlog and computes distribution histograms", () => {
    const result = buildDistribution(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.pendingCount).toBe(1);
    expect(result.taskFrequency.length).toBeGreaterThan(0);
    expect(result.completionHistogram).toHaveLength(10);
    expect(result.backlogTrend).toHaveLength(2);
    expect(result.averages.assigned).toBe(1);
  });

  it("lists overdue tasks with heuristic probability and lag distribution", () => {
    const result = buildAging(tasks, categories, "UTC");

    expect(result.overdue.length).toBeGreaterThanOrEqual(1);
    expect(result.overdue[0].probability).toMatch(/^(low|medium|high)$/);
    expect(result.aging.length).toBeGreaterThan(0);
    expect(result.completionLag.histogram.length).toBeGreaterThan(0);
    expect(result.generatedAt).toBeTruthy();
  });

  it("breaks priority and duration analytics down per priority", () => {
    const result = buildPriorityDuration(tasks, categories, "UTC");

    expect(result.byPriority).toHaveLength(4);
    const high = result.byPriority.find((entry) => entry.priority === "HIGH");
    expect(high?.completionRate).toBe(100);
    expect(result.duration.overall.estimated).toBe(25);
    expect(result.duration.byCategory[0].categoryName).toBe("Work");
    expect(result.efficiencyScore).not.toBeNull();
    expect(result.peakHours).not.toBeNull();
    expect(result.usage.priorityTasks).toBe(2);
    expect(result.usage.durationTasks).toBe(2);
  });

  it("counts incomplete and missed tasks per day", () => {
    const result = buildMissedTasks(
      tasks,
      categories,
      new Date("2026-08-03T00:00:00.000Z"),
      new Date("2026-08-04T23:59:59.000Z"),
      "UTC",
    );

    expect(result.totals.assigned).toBe(2);
    expect(result.totals.completed).toBe(1);
    expect(result.totals.incomplete).toBe(1);
    expect(result.totals.missed).toBe(1);
    expect(result.totals.missedRate).toBe(50);
    expect(result.series[0]).toMatchObject({ date: "2026-08-03", incomplete: 0 });
    expect(result.series[1]).toMatchObject({ date: "2026-08-04", incomplete: 1 });
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0].title).toBe("B");
    expect(result.missed[0].daysOverdue).toBeGreaterThan(0);
    expect(result.overdueNow).toBe(1);
    expect(result.missedToday).toBe(0);
  });

  it("flags tasks due today as missed today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = {
      ...tasks[1],
      id: "task-today",
      dueDate: new Date(`${today}T00:00:00.000Z`),
      createdAt: new Date(`${today}T00:00:00.000Z`),
    };

    const result = buildMissedTasks(
      [dueToday],
      categories,
      new Date(`${today}T00:00:00.000Z`),
      new Date(`${today}T23:59:59.000Z`),
      "UTC",
    );

    expect(result.missedToday).toBe(1);
    expect(result.overdueNow).toBe(0);
    expect(result.missed).toHaveLength(1);
    expect(result.missed[0].daysOverdue).toBe(0);
    expect(result.totals.missed).toBe(1);
  });
});

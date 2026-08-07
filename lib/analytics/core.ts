import { Priority, type Category } from "@prisma/client";
import { eachWeekOfInterval, format, startOfWeek } from "date-fns";

import { bucketDate, compareDateKeys, enumerateDateKeys, getDateKey, parseDateKey, shiftDateKey, todayKey } from "@/lib/date";
import type { TaskWithRelations } from "@/lib/types";
import { clamp, round } from "@/lib/utils";

// ─── Internal types ────────────────────────────────────────────────────────────

type DailyBucket = {
  date: string;
  assigned: number;
  completed: number;
  incomplete: number;
  completionRate: number;
  categories: Record<string, { assigned: number; completed: number; incomplete: number }>;
};

type Cohort = { assigned: number; completed: number; incomplete: number };

type BuildResult = {
  daily: DailyBucket[];
  byCategory: Map<string, { assigned: number; completed: number; incomplete: number }>;
  cohort: Cohort;
  completedPerDay: number[];
  createdDates: string[];
};

type NormalizedTask = TaskWithRelations & {
  assignedDate: string;
  completedDate: string | null;
  createdDate: string;
};

// ─── Internal helpers ──────────────────────────────────────────────────────────

function normalizeTasks(tasks: TaskWithRelations[], timezone: string): NormalizedTask[] {
  return tasks.map((task) => ({
    ...task,
    assignedDate: bucketDate(task.dueDate, task.createdAt, timezone),
    completedDate: task.completedAt ? getDateKey(task.completedAt, timezone) : null,
    createdDate: getDateKey(task.createdAt, timezone),
  }));
}

function buildBuckets(tasks: TaskWithRelations[], categories: Category[], from: Date, to: Date, timezone: string): BuildResult {
  const normalized = normalizeTasks(tasks, timezone);
  const dateKeys = enumerateDateKeys(from, to, timezone);
  const dailyMap = new Map<string, DailyBucket>();
  const byCategory = new Map<string, { assigned: number; completed: number; incomplete: number }>();
  const cohort: Cohort = { assigned: 0, completed: 0, incomplete: 0 };
  const createdDates: string[] = [];

  for (const category of categories) {
    byCategory.set(category.id, { assigned: 0, completed: 0, incomplete: 0 });
  }

  for (const key of dateKeys) {
    dailyMap.set(key, { date: key, assigned: 0, completed: 0, incomplete: 0, completionRate: 0, categories: {} });
  }

  for (const task of normalized) {
    const day = dailyMap.get(task.assignedDate);
    if (!day) continue; // assigned outside range → not part of the cohort

    cohort.assigned += 1;
    day.assigned += 1;
    day.categories[task.categoryId] ??= { assigned: 0, completed: 0, incomplete: 0 };
    day.categories[task.categoryId].assigned += 1;

    const categoryStats = byCategory.get(task.categoryId);
    if (categoryStats) categoryStats.assigned += 1;

    if (task.completedAt) {
      cohort.completed += 1;
      if (categoryStats) categoryStats.completed += 1;
    } else {
      cohort.incomplete += 1;
      day.incomplete += 1;
      if (categoryStats) categoryStats.incomplete += 1;
    }

    if (task.completedDate && dailyMap.has(task.completedDate)) {
      const completedDay = dailyMap.get(task.completedDate)!;
      completedDay.completed += 1;
      completedDay.categories[task.categoryId] ??= { assigned: 0, completed: 0, incomplete: 0 };
      completedDay.categories[task.categoryId].completed += 1;
    }

    if (dailyMap.has(task.createdDate)) {
      createdDates.push(task.createdDate);
    }
  }

  const daily = dateKeys.map((key) => {
    const bucket = dailyMap.get(key)!;
    return {
      ...bucket,
      completionRate: bucket.assigned === 0 ? 0 : round((bucket.completed / bucket.assigned) * 100, 2),
    };
  });

  return {
    daily,
    byCategory,
    cohort,
    completedPerDay: daily.map((day) => day.completed),
    createdDates,
  };
}

function cohortRate(built: BuildResult) {
  return built.cohort.assigned === 0 ? 0 : round((built.cohort.completed / built.cohort.assigned) * 100, 2);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
}

function statsForWindow(daily: DailyBucket[], fromKey: string, toKey: string) {
  const days = daily.filter((day) => day.date >= fromKey && day.date <= toKey);
  const assigned = days.reduce((sum, day) => sum + day.assigned, 0);
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  return {
    rate: assigned === 0 ? 0 : round((completed / assigned) * 100, 2),
    assigned,
    completed,
  };
}

function currentStreak(daily: DailyBucket[], timezone: string) {
  const sorted = [...daily].sort((a, b) => compareDateKeys(a.date, b.date));
  const today = todayKey(timezone);
  const yesterday = shiftDateKey(today, -1, timezone);
  const lastActive = [...sorted].reverse().find((day) => day.completed > 0);
  if (!lastActive) return 0;
  if (![today, yesterday].includes(lastActive.date)) return 0;

  let streak = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (sorted[index].completed > 0) streak += 1;
    else if (streak > 0) break;
  }
  return streak;
}

function streakSegments(daily: DailyBucket[]) {
  const segments: { start: string; end: string; length: number }[] = [];
  let current: DailyBucket[] = [];
  for (const day of daily) {
    if (day.completed > 0) {
      current.push(day);
    } else if (current.length > 0) {
      segments.push({
        start: current[0].date,
        end: current[current.length - 1].date,
        length: current.length,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push({
      start: current[0].date,
      end: current[current.length - 1].date,
      length: current.length,
    });
  }
  return segments;
}

function longestStreak(daily: DailyBucket[]) {
  let longest = 0;
  let current = 0;
  let bestEnd = "";
  for (const day of daily) {
    if (day.completed > 0) {
      current += 1;
      if (current >= longest) {
        longest = current;
        bestEnd = day.date;
      }
    } else {
      current = 0;
    }
  }
  return { length: longest, endDate: bestEnd };
}

function regression(values: number[]) {
  if (values.length < 2) {
    return { slope: 0, intercept: values[0] ?? 0 };
  }

  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + index * value, 0);
  const sumXX = values.reduce((sum, _value, index) => sum + index * index, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function weekStartKey(dateKey: string, weekStartsOn: number): string {
  const date = parseDateKey(dateKey, "UTC");
  const day = date.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function quarterStartKey(dateKey: string): string {
  const month = Number(dateKey.slice(5, 7));
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const padded = String(quarterStartMonth).padStart(2, "0");
  return `${dateKey.slice(0, 5)}${padded}-01`;
}

const STREAK_DISTRIBUTION_BUCKETS = [
  { label: "1", min: 1, max: 1 },
  { label: "2–3", min: 2, max: 3 },
  { label: "4–7", min: 4, max: 7 },
  { label: "8–14", min: 8, max: 14 },
  { label: "15–30", min: 15, max: 30 },
  { label: "31+", min: 31, max: Infinity },
];

// ─── Section 15.1: Completion Rates ────────────────────────────────────────────

export type CurrentPeriodTiles = { daily: number; weekly: number; monthly: number; yearly: number };

export function buildCurrentPeriodTiles(tasks: TaskWithRelations[], categories: Category[], timezone: string, weekStartsOn = 1): CurrentPeriodTiles {
  const now = new Date();
  const today = todayKey(timezone);
  const yearStart = new Date(today.slice(0, 5) + "01-01T00:00:00Z");
  const built = buildBuckets(tasks, categories, yearStart, now, timezone);

  const rateFor = (fromKey: string, toKey: string) => {
    const window = built.daily.filter((day) => day.date >= fromKey && day.date <= toKey);
    const assigned = window.reduce((sum, day) => sum + day.assigned, 0);
    const completed = window.reduce((sum, day) => sum + day.completed, 0);
    return assigned === 0 ? 0 : round((completed / assigned) * 100, 2);
  };

  return {
    daily: rateFor(today, today),
    weekly: rateFor(weekStartKey(today, weekStartsOn), today),
    monthly: rateFor(`${today.slice(0, 7)}-01`, today),
    yearly: rateFor(`${today.slice(0, 5)}-01-01`, today),
  };
}

export function buildCompletionRates(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
  weekStartsOn = 1,
  current?: CurrentPeriodTiles,
  priorFrom?: Date,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const priorBuilt = priorFrom ? buildBuckets(tasks, categories, priorFrom, from, timezone) : null;

  const weekdayOrder: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const index = (weekStartsOn + offset) % 7;
    weekdayOrder.push(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]);
  }

  const weekdayMap = new Map<string, number[]>();
  for (const day of built.daily) {
    const label = format(new Date(`${day.date}T00:00:00`), "EEEE");
    const existing = weekdayMap.get(label) ?? [];
    existing.push(day.completionRate);
    weekdayMap.set(label, existing);
  }

  return {
    overallCompletionRate: cohortRate(built),
    overallRateDelta: priorBuilt ? round(cohortRate(built) - cohortRate(priorBuilt), 2) : null,
    totals: { assigned: built.cohort.assigned, completed: built.cohort.completed },
    byWeekday: weekdayOrder.map((weekday) => ({
      weekday,
      completionRate: round(mean(weekdayMap.get(weekday) ?? []), 2),
    })),
    byMonth: Object.values(
      built.daily.reduce<Record<string, { month: string; assigned: number; completed: number }>>((acc, day) => {
        const month = day.date.slice(0, 7);
        acc[month] ??= { month, assigned: 0, completed: 0 };
        acc[month].assigned += day.assigned;
        acc[month].completed += day.completed;
        return acc;
      }, {}),
    ).map((month) => ({
      month: month.month,
      completionRate: month.assigned === 0 ? 0 : round((month.completed / month.assigned) * 100, 2),
    })),
    current: current ?? { daily: 0, weekly: 0, monthly: 0, yearly: 0 },
    daily: built.daily,
  };
}

// ─── Section 15.2: Assigned vs. Completed ──────────────────────────────────────

function aggregateSeries(daily: DailyBucket[], granularity: "daily" | "weekly" | "monthly", weekStartsOn: number) {
  if (granularity === "daily") {
    return daily.map((day) => ({ date: day.date, assigned: day.assigned, completed: day.completed, incomplete: day.incomplete }));
  }

  const buckets = new Map<string, { date: string; assigned: number; completed: number; incomplete: number }>();
  for (const day of daily) {
    const key = granularity === "weekly" ? weekStartKey(day.date, weekStartsOn) : day.date.slice(0, 7);
    const existing = buckets.get(key) ?? { date: key, assigned: 0, completed: 0, incomplete: 0 };
    existing.assigned += day.assigned;
    existing.completed += day.completed;
    existing.incomplete += day.incomplete;
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildAssignedVsCompleted(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
  weekStartsOn = 1,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const days = enumerateDateKeys(from, to, timezone).length;
  const granularity: "daily" | "weekly" | "monthly" = days <= 31 ? "daily" : days <= 180 ? "weekly" : "monthly";

  const categoryComparison = categories.map((category) => {
    const stats = built.byCategory.get(category.id) ?? { assigned: 0, completed: 0, incomplete: 0 };
    return {
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      assigned: stats.assigned,
      completed: stats.completed,
      incomplete: stats.incomplete,
      completionRate: stats.assigned === 0 ? 0 : round((stats.completed / stats.assigned) * 100, 2),
    };
  });

  return {
    granularity,
    series: aggregateSeries(built.daily, granularity, weekStartsOn),
    categories: categoryComparison.sort((a, b) => b.completionRate - a.completionRate),
    radar: categoryComparison
      .filter((category) => category.assigned > 0)
      .map((category) => ({ categoryName: category.categoryName, completionRate: category.completionRate })),
  };
}

// ─── Section 15.3: Trends ──────────────────────────────────────────────────────

export function buildTrends(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const dailyRates = built.daily.map((day) => day.completionRate);
  const { slope, intercept } = regression(dailyRates);

  const residualWindow = dailyRates.slice(-30);
  const fitted = residualWindow.map((_value, index) => intercept + slope * (Math.max(0, dailyRates.length - residualWindow.length) + index));
  const residuals = residualWindow.map((value, index) => Math.abs(value - fitted[index]));
  const residualStd = stdDev(residuals);

  const n = dailyRates.length;
  const forecastStart = built.daily.length > 0 ? shiftDateKey(built.daily[built.daily.length - 1].date, 1, timezone) : getDateKey(to, timezone);
  const forecast = Array.from({ length: 14 }).map((_, index) => {
    const raw = intercept + slope * (n + index);
    return {
      date: shiftDateKey(forecastStart, index, timezone),
      value: clamp(round(raw, 2), 0, 100),
      lower: clamp(round(raw - residualStd, 2), 0, 100),
      upper: clamp(round(raw + residualStd, 2), 0, 100),
    };
  });

  let cumulative = 0;
  const cumulativeSeries = built.daily.map((day) => {
    cumulative += day.completed;
    return { date: day.date, value: cumulative };
  });

  const createdMap = new Map<string, number>();
  for (const date of built.createdDates) {
    createdMap.set(date, (createdMap.get(date) ?? 0) + 1);
  }
  const creationTrend = built.daily.map((day) => ({ date: day.date, count: createdMap.get(day.date) ?? 0 }));

  const completionCountTrend = built.daily.map((day) => ({ date: day.date, count: day.completed }));

  const rolling = (windowSize: number) =>
    built.daily.map((day, index, arr) => ({
      date: day.date,
      value: round(mean(arr.slice(Math.max(0, index - windowSize + 1), index + 1).map((item) => item.completionRate)), 2),
    }));

  const rolling7 = rolling(7);
  const rolling30 = rolling(30);
  const rolling90 = rolling(90);

  const currentRolling = (windowSize: number) => mean(dailyRates.slice(-windowSize));
  const priorRolling = (windowSize: number) => mean(dailyRates.slice(-windowSize - 7, -7));
  const delta = (windowSize: number) => (dailyRates.length >= windowSize + 7 ? round(currentRolling(windowSize) - priorRolling(windowSize), 2) : null);

  return {
    completionTrend: built.daily,
    rolling7,
    rolling30,
    rolling90,
    cumulative: cumulativeSeries,
    creationTrend,
    completionCountTrend,
    rollingAverages: {
      r7: round(currentRolling(7), 2),
      r30: round(currentRolling(30), 2),
      r90: round(currentRolling(90), 2),
      deltas: { r7: delta(7), r30: delta(30), r90: delta(90) },
    },
    forecast,
    forecastStd: round(residualStd, 2),
  };
}

// ─── Section 15.4: Scores ──────────────────────────────────────────────────────

export function buildScores(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
) {
  const length = enumerateDateKeys(from, to, timezone).length;
  const fromKey = getDateKey(from, timezone);
  const toKey = getDateKey(to, timezone);
  const supFrom = parseDateKey(shiftDateKey(fromKey, -length, timezone), timezone);

  const built = buildBuckets(tasks, categories, from, to, timezone);
  const priorBuilt = buildBuckets(tasks, categories, supFrom, from, timezone);

  const completionRate = built.cohort.assigned === 0 ? 0 : (built.cohort.completed / built.cohort.assigned) * 100;
  const priorRate = priorBuilt.cohort.assigned === 0 ? 0 : (priorBuilt.cohort.completed / priorBuilt.cohort.assigned) * 100;
  const completedPerDay = mean(built.completedPerDay);
  const personalBest = Math.max(...built.completedPerDay, 1);
  const dailyRates = built.daily.map((day) => day.completionRate);
  const sd = stdDev(dailyRates);
  const topCategory = [...built.byCategory.entries()].sort((a, b) => b[1].completed - a[1].completed)[0];

  const today = todayKey(timezone);
  const inRange = tasks.filter((task) => {
    const key = bucketDate(task.dueDate, task.createdAt, timezone);
    return key >= fromKey && key <= toKey;
  });
  const overdueIncomplete = inRange.filter(
    (task) => !task.completedAt && task.dueDate && getDateKey(task.dueDate, timezone) < today,
  ).length;

  const daysWithCompletion = built.daily.filter((day) => day.completed > 0).length;
  const totalDays = Math.max(built.daily.length, 1);
  const rolling7 = mean(dailyRates.slice(-7));
  const rolling30 = mean(dailyRates.slice(-30));

  const durationTasks = inRange.filter(
    (task) => task.estimatedDurationMinutes != null && task.actualDurationMinutes != null,
  );

  const missedDays = built.daily.filter((day) => day.assigned > 0 && day.completed === 0);
  let recoveryAverage: number | null = null;
  if (missedDays.length > 0) {
    const recoveries = missedDays.map((day, index) => {
      const nextProductive = built.daily.find(
        (candidate, candidateIndex) => candidateIndex > index && candidate.completed > 0,
      );
      if (nextProductive) return compareDateKeys(nextProductive.date, day.date);
      return built.daily.length - index;
    });
    recoveryAverage = mean(recoveries);
  }

  const efficiency =
    durationTasks.length === 0
      ? null
      : round(
          clamp(
            100 -
              mean(
                durationTasks.map((task) =>
                  (Math.abs((task.actualDurationMinutes ?? 0) - (task.estimatedDurationMinutes ?? 1)) /
                    (task.estimatedDurationMinutes ?? 1)) *
                    100,
                ),
              ),
            0,
            100,
          ),
          2,
        );

  const taskDiscipline = clamp(100 - (overdueIncomplete / Math.max(inRange.length, 1)) * 100, 0, 100);
  const habit = (daysWithCompletion / totalDays) * 100;
  const consistency = clamp(100 - sd, 0, 100);

  return {
    productivityScore: round(clamp(0.6 * completionRate + 0.4 * ((completedPerDay / personalBest) * 100), 0, 100), 2),
    consistencyScore: round(consistency, 2),
    focusScore: round(((topCategory?.[1].completed ?? 0) / Math.max(built.cohort.completed, 1)) * 100, 2),
    taskDisciplineScore: round(taskDiscipline, 2),
    habitScore: round(habit, 2),
    momentumScore: round(clamp(rolling7 - rolling30 + 50, 0, 100), 2),
    recoveryScore: recoveryAverage === null ? null : round(clamp(100 - (recoveryAverage - 1) * 25, 0, 100), 2),
    efficiencyScore: efficiency,
    selfImprovementScore: round(clamp(completionRate - priorRate + 50, 0, 100), 2),
    accountabilityIndex: round(0.5 * taskDiscipline + 0.3 * habit + 0.2 * consistency, 2),
    personalWorkloadIndex: round(
      mean(built.daily.filter((day) => day.assigned > 0).map((day) => day.assigned)),
      2,
    ),
    inputs: {
      completionRate: round(completionRate, 2),
      priorCompletionRate: round(priorRate, 2),
      completedPerDay: round(completedPerDay, 2),
      personalBestCompletedPerDay: personalBest,
      stdDevDailyRates: round(sd, 2),
      topCategoryName: topCategory ? categories.find((category) => category.id === topCategory[0])?.name ?? null : null,
      totalCompleted: built.cohort.completed,
      totalAssigned: built.cohort.assigned,
      overdueIncomplete,
      daysWithCompletion,
      totalDays: built.daily.length,
      rolling7: round(rolling7, 2),
      rolling30: round(rolling30, 2),
      recoveryAverage: recoveryAverage === null ? null : round(recoveryAverage, 2),
      durationTaskCount: durationTasks.length,
    },
  };
}

// ─── Section 15.5: Streaks ─────────────────────────────────────────────────────

export function buildStreaks(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
  weekStartsOn = 1,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const longest = longestStreak(built.daily);
  const segments = streakSegments(built.daily);

  const distribution = STREAK_DISTRIBUTION_BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: segments.filter((segment) => segment.length >= bucket.min && segment.length <= bucket.max).length,
  }));

  const toKey = getDateKey(to, timezone);
  const brokenStreaks = [];
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const brokeOn = shiftDateKey(segment.end, 1, timezone);
    if (brokeOn > toKey) continue;
    const next = segments[index + 1];
    brokenStreaks.push({
      brokeOn,
      length: segment.length,
      daysToNext: compareDateKeys(next.start, segment.end),
    });
  }

  const missedDays = built.daily.filter((day) => day.assigned > 0 && day.completed === 0);
  const perfectDays = built.daily.filter((day) => day.assigned > 0 && day.completionRate === 100);

  // Perfect weeks: full 7-day weeks (per week-start) fully inside the range.
  const perfectWeeks: { start: string; end: string }[] = [];
  const weeklyMap = new Map<string, DailyBucket[]>();
  for (const day of built.daily) {
    const key = weekStartKey(day.date, weekStartsOn);
    const existing = weeklyMap.get(key) ?? [];
    existing.push(day);
    weeklyMap.set(key, existing);
  }
  for (const [start, days] of weeklyMap) {
    if (days.length < 7) continue;
    const hasTasks = days.some((day) => day.assigned > 0);
    const allPerfect = days.every((day) => day.assigned === 0 || day.completionRate === 100);
    if (hasTasks && allPerfect) {
      perfectWeeks.push({ start, end: shiftDateKey(start, 6, timezone) });
    }
  }

  // Perfect months: full calendar months fully inside the range.
  const perfectMonths: string[] = [];
  const monthlyMap = new Map<string, DailyBucket[]>();
  for (const day of built.daily) {
    const key = day.date.slice(0, 7);
    const existing = monthlyMap.get(key) ?? [];
    existing.push(day);
    monthlyMap.set(key, existing);
  }
  for (const [month, days] of monthlyMap) {
    const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    if (days.length < daysInMonth) continue;
    const hasTasks = days.some((day) => day.assigned > 0);
    const allPerfect = days.every((day) => day.assigned === 0 || day.completionRate === 100);
    if (hasTasks && allPerfect) {
      perfectMonths.push(month);
    }
  }

  // Longest productive period: sustained completion >= threshold, 0-task days are neutral.
  let productiveBest = { length: 0, start: "", end: "" };
  let productiveCurrent = { length: 0, start: "" };
  for (const day of built.daily) {
    if (day.assigned === 0) continue;
    if (day.completionRate >= 70) {
      productiveCurrent.length += 1;
      if (!productiveCurrent.start) productiveCurrent.start = day.date;
      if (productiveCurrent.length > productiveBest.length) {
        productiveBest = { ...productiveCurrent, end: day.date };
      }
    } else {
      productiveCurrent = { length: 0, start: "" };
    }
  }

  const categoryStreaks = categories.map((category) => {
    const categoryTasks = tasks.filter((task) => task.categoryId === category.id);
    const categoryBuilt = buildBuckets(categoryTasks, [category], from, to, timezone);
    const categorySegments = streakSegments(categoryBuilt.daily);
    return {
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      current: currentStreak(categoryBuilt.daily, timezone),
      longest: categorySegments.reduce((max, segment) => Math.max(max, segment.length), 0),
    };
  });

  return {
    currentStreak: currentStreak(built.daily, timezone),
    longestStreak: longest,
    averageStreakLength: round(mean(segments.map((segment) => segment.length)), 2),
    medianStreakLength: round(median(segments.map((segment) => segment.length)), 2),
    streakDistribution: distribution,
    brokenStreaks,
    streakSegments: segments,
    categoryStreaks,
    perfectDays: perfectDays.length,
    perfectDayDates: perfectDays.map((day) => day.date),
    perfectWeeks,
    perfectMonths,
    longestProductivePeriod: productiveBest,
    missedDays: missedDays.length,
    timeline: built.daily,
  };
}

// ─── Section 15.6: Category Deep Dive ──────────────────────────────────────────

export function buildCategoryDeepDive(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
) {
  const length = enumerateDateKeys(from, to, timezone).length;
  const fromKey = getDateKey(from, timezone);
  const supFrom = parseDateKey(shiftDateKey(fromKey, -length, timezone), timezone);

  const built = buildBuckets(tasks, categories, from, to, timezone);
  const priorBuilt = buildBuckets(tasks, categories, supFrom, from, timezone);
  const totalAssigned = built.cohort.assigned;

  const ranking = categories
    .map((category) => {
      const stats = built.byCategory.get(category.id) ?? { assigned: 0, completed: 0 };
      const priorStats = priorBuilt.byCategory.get(category.id) ?? { assigned: 0, completed: 0 };
      const completionRate = stats.assigned === 0 ? 0 : round((stats.completed / stats.assigned) * 100, 2);
      const priorRate = priorStats.assigned === 0 ? 0 : (priorStats.completed / priorStats.assigned) * 100;

      const categoryTasks = tasks.filter((task) => task.categoryId === category.id);
      const categoryBuilt = buildBuckets(categoryTasks, [category], from, to, timezone);
      const categoryRates = categoryBuilt.daily.map((day) => day.completionRate);
      const categorySegments = streakSegments(categoryBuilt.daily);

      return {
        categoryId: category.id,
        categoryName: category.name,
        color: category.color,
        icon: category.icon,
        assigned: stats.assigned,
        completed: stats.completed,
        completionRate,
        trend: round(completionRate - priorRate, 2),
        consistency: round(clamp(100 - stdDev(categoryRates), 0, 100), 2),
        saturation: totalAssigned === 0 ? 0 : round((stats.assigned / totalAssigned) * 100, 2),
        momentum: round(
          clamp(mean(categoryRates.slice(-7)) - mean(categoryRates.slice(-30)) + 50, 0, 100),
          2,
        ),
        currentStreak: currentStreak(categoryBuilt.daily, timezone),
        longestStreak: categorySegments.reduce((max, segment) => Math.max(max, segment.length), 0),
      };
    })
    .sort((a, b) => b.completionRate - a.completionRate);

  const eligible = ranking.filter((category) => category.assigned >= 5);
  const best = eligible.length > 0 ? eligible[0] : null;
  const worst = eligible.length > 0 ? [...eligible].sort((a, b) => a.completionRate - b.completionRate)[0] : null;

  const saturationValues = ranking.map((category) => category.saturation);
  const saturationMean = mean(saturationValues);
  const balance =
    totalAssigned === 0 || saturationMean === 0
      ? null
      : round(clamp(100 - (stdDev(saturationValues) / saturationMean) * 100, 0, 100), 2);

  return {
    ranking,
    best,
    worst,
    balance,
    saturation: ranking.map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      color: category.color,
      pct: category.saturation,
    })),
  };
}

// ─── Section 15.7: Time Comparisons ────────────────────────────────────────────

export function buildTimeComparisons(
  tasks: TaskWithRelations[],
  categories: Category[],
  _from: Date,
  to: Date,
  timezone: string,
  weekStartsOn = 1,
) {
  const today = todayKey(timezone);
  const now = new Date();
  const toDate = to > now ? now : to;
  const built = buildBuckets(tasks, categories, parseDateKey(today.slice(0, 5) + "01-01", timezone), toDate, timezone);

  const compare = (curFrom: string, prevFrom: string, prevTo: string) => {
    const current = statsForWindow(built.daily, curFrom, today);
    const previous = statsForWindow(built.daily, prevFrom, prevTo);
    return {
      current,
      previous,
      delta: {
        rate: round(current.rate - previous.rate, 2),
        assigned: current.assigned - previous.assigned,
        completed: current.completed - previous.completed,
      },
    };
  };

  const year = today.slice(0, 4);
  const month = today.slice(5, 7);
  const quarterStart = quarterStartKey(today);
  const quarterStartDate = parseDateKey(quarterStart, "UTC");
  const prevQuarter = new Date(quarterStartDate);
  prevQuarter.setUTCMonth(prevQuarter.getUTCMonth() - 3);
  const prevQuarterStart = prevQuarter.toISOString().slice(0, 10);
  const prevQuarterEnd = shiftDateKey(quarterStart, -1, timezone);

  const prevYearMonthDay = `${Number(year) - 1}-${month}-${today.slice(8, 10)}`;

  return {
    weekly: compare(weekStartKey(today, weekStartsOn), weekStartKey(shiftDateKey(today, -7, timezone), weekStartsOn), shiftDateKey(weekStartKey(today, weekStartsOn), -1, timezone)),
    monthly: compare(`${today.slice(0, 7)}-01`, `${shiftDateKey(`${today.slice(0, 7)}-01`, -1, timezone).slice(0, 7)}-01`, shiftDateKey(`${today.slice(0, 7)}-01`, -1, timezone)),
    quarterly: compare(quarterStart, prevQuarterStart, prevQuarterEnd),
    yearly: compare(`${year}-01-01`, `${Number(year) - 1}-01-01`, prevYearMonthDay),
  };
}

// ─── Section 15.8: Distribution & Volume ───────────────────────────────────────

export function buildDistribution(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
  weekStartsOn = 1,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const today = todayKey(timezone);

  const maxFrequency = Math.max(...built.daily.map((day) => day.assigned), 0);
  const frequencyBuckets = Array.from({ length: Math.min(maxFrequency, 10) + 1 }).map((_, count) => {
    const countLabel = count;
    return {
      label: String(countLabel),
      count: built.daily.filter((day) => day.assigned === countLabel).length,
    };
  });
  if (maxFrequency > 10) {
    frequencyBuckets.push({
      label: "10+",
      count: built.daily.filter((day) => day.assigned > 10).length,
    });
  }

  const completionBuckets = Array.from({ length: 10 }).map((_, index) => {
    const min = index * 10;
    const max = index * 10 + 10;
    return {
      bucket: `${min + (index === 0 ? 0 : 1)}–${max}%`,
      count: built.daily.filter((day) => day.completionRate > min && day.completionRate <= max).length,
    };
  });

  const weeklyVolume = new Map<string, number>();
  for (const day of built.daily) {
    const key = weekStartKey(day.date, weekStartsOn);
    weeklyVolume.set(key, (weeklyVolume.get(key) ?? 0) + day.assigned);
  }
  const volumeTrend = Array.from(weeklyVolume.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, assigned]) => ({ label, assigned }));

  const weeksInRange = Math.max(volumeTrend.length, 1);
  const taskDensity = categories.map((category) => {
    const stats = built.byCategory.get(category.id) ?? { assigned: 0, completed: 0 };
    return {
      categoryId: category.id,
      categoryName: category.name,
      color: category.color,
      perWeek: round(stats.assigned / weeksInRange, 2),
    };
  });

  const completionDistribution = built.daily
    .filter((day) => day.completed > 0)
    .map((day) => ({
      date: day.date,
      ...Object.fromEntries(
        Object.entries(day.categories).map(([categoryId, stats]) => [categoryId, stats.completed]),
      ),
    }));

  const pendingCount = tasks.filter(
    (task) => !task.completedAt && task.dueDate && getDateKey(task.dueDate, timezone) <= today,
  ).length;

  const backlogTrend = built.daily.map((day) => ({
    date: day.date,
    count: tasks.filter(
      (task) =>
        task.dueDate &&
        getDateKey(task.dueDate, timezone) <= day.date &&
        (!task.completedAt || getDateKey(task.completedAt, timezone) > day.date),
    ).length,
  }));

  const completedPerDay = built.daily.map((day) => day.completed);
  const last7 = completedPerDay.slice(-7).reduce((sum, value) => sum + value, 0);
  const prior7 = completedPerDay.slice(-14, -7).reduce((sum, value) => sum + value, 0);
  const velocity = prior7 === 0 ? null : round(((last7 - prior7) / prior7) * 100, 2);

  return {
    taskFrequency: frequencyBuckets,
    completionHistogram: completionBuckets,
    volumeTrend,
    taskDensity,
    completionDistribution,
    averages: {
      assigned: round(mean(built.daily.map((day) => day.assigned)), 2),
      completed: round(mean(completedPerDay), 2),
    },
    pendingCount,
    backlogTrend,
    velocity,
  };
}

// ─── Section 15.9: Aging & Overdue ─────────────────────────────────────────────

const AGING_BUCKETS = [
  { label: "0–1 days", min: 0, max: 1 },
  { label: "2–3 days", min: 2, max: 3 },
  { label: "4–7 days", min: 4, max: 7 },
  { label: "8–14 days", min: 8, max: 14 },
  { label: "15–30 days", min: 15, max: 30 },
  { label: "31+ days", min: 31, max: Infinity },
];

const LAG_BUCKETS = [
  { label: "7+ days early", min: -Infinity, max: -7 },
  { label: "1–6 days early", min: -6, max: -1 },
  { label: "On time", min: 0, max: 0 },
  { label: "1–7 days late", min: 1, max: 7 },
  { label: "8–30 days late", min: 8, max: 30 },
  { label: "31+ days late", min: 31, max: Infinity },
];

export function buildAging(tasks: TaskWithRelations[], categories: Category[], timezone: string) {
  const nowKey = todayKey(timezone);
  const now = new Date();

  const rateByCategory = new Map<string, number>();
  for (const category of categories) {
    const inCategory = tasks.filter((task) => task.categoryId === category.id);
    rateByCategory.set(
      category.id,
      inCategory.length === 0 ? 0 : round((inCategory.filter((task) => task.completedAt).length / inCategory.length) * 100, 1),
    );
  }

  const overdue = tasks
    .filter((task) => !task.completedAt && task.dueDate && getDateKey(task.dueDate, timezone) < nowKey)
    .map((task) => {
      const daysOverdue = compareDateKeys(nowKey, getDateKey(task.dueDate!, timezone));
      const rate = rateByCategory.get(task.categoryId) ?? 0;
      const recency = daysOverdue <= 7 ? 1.2 : daysOverdue <= 30 ? 1 : 0.8;
      const probability = (rate / 100) * recency;
      return {
        id: task.id,
        title: task.title,
        category: task.category.name,
        categoryId: task.categoryId,
        daysOverdue,
        priority: task.priority,
        probability: probability < 0.3 ? "low" as const : probability < 0.6 ? "medium" as const : "high" as const,
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const aging = AGING_BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: tasks.filter((task) => {
      if (task.completedAt) return false;
      const age = compareDateKeys(nowKey, getDateKey(task.createdAt, timezone));
      return age >= bucket.min && age <= bucket.max;
    }).length,
  }));

  const lagValues = tasks
    .filter((task) => task.completedAt && task.dueDate)
    .map((task) => compareDateKeys(getDateKey(task.completedAt!, timezone), getDateKey(task.dueDate!, timezone)));

  return {
    overdue,
    aging,
    completionLag: {
      average: round(mean(lagValues), 2),
      histogram: LAG_BUCKETS.map((bucket) => ({
        bucket: bucket.label,
        count: lagValues.filter((value) => value >= bucket.min && value <= bucket.max).length,
      })),
    },
    generatedAt: now.toISOString(),
  };
}

// ─── Section 15.10: Priority & Duration ────────────────────────────────────────

export function buildPriorityDuration(tasks: TaskWithRelations[], categories: Category[], timezone: string) {
  const byPriority = Object.values(Priority).map((priority) => {
    const items = tasks.filter((task) => task.priority === priority);
    const completed = items.filter((task) => task.completedAt).length;
    return {
      priority,
      total: items.length,
      completionRate: items.length === 0 ? 0 : round((completed / items.length) * 100, 2),
    };
  });

  const withEstimated = tasks.filter((task) => task.estimatedDurationMinutes != null);
  const withActual = tasks.filter((task) => task.actualDurationMinutes != null);

  const durationByCategory = categories.map((category) => {
    const inCategory = tasks.filter((task) => task.categoryId === category.id);
    const estimated = inCategory.filter((task) => task.estimatedDurationMinutes != null);
    const actual = inCategory.filter((task) => task.actualDurationMinutes != null);
    return {
      categoryId: category.id,
      categoryName: category.name,
      estimated: round(mean(estimated.map((task) => task.estimatedDurationMinutes ?? 0)), 2),
      actual: round(mean(actual.map((task) => task.actualDurationMinutes ?? 0)), 2),
    };
  });

  const durationTasks = tasks.filter(
    (task) => task.estimatedDurationMinutes != null && task.actualDurationMinutes != null,
  );
  const efficiencyScore =
    durationTasks.length === 0
      ? null
      : round(
          clamp(
            100 -
              mean(
                durationTasks.map((task) =>
                  (Math.abs((task.actualDurationMinutes ?? 0) - (task.estimatedDurationMinutes ?? 1)) /
                    (task.estimatedDurationMinutes ?? 1)) *
                    100,
                ),
              ),
            0,
            100,
          ),
          2,
        );

  // Peak hours: completions by local hour; null when meaningless (no variation / midnight-defaults).
  const hourCounts = new Map<number, number>();
  for (const task of tasks) {
    if (!task.completedAt) continue;
    const local = new Date(task.completedAt.toLocaleString("en-US", { timeZone: timezone }));
    if (Number.isNaN(local.getHours())) continue;
    hourCounts.set(local.getHours(), (hourCounts.get(local.getHours()) ?? 0) + 1);
  }
  const totalCompletions = Array.from(hourCounts.values()).reduce((sum, count) => sum + count, 0);
  const peakHours =
    totalCompletions === 0 || (hourCounts.get(0) ?? 0) / totalCompletions > 0.9
      ? null
      : Array.from({ length: 24 }).map((_, hour) => ({
          hour,
          count: hourCounts.get(hour) ?? 0,
        }));

  return {
    byPriority,
    duration: {
      overall: {
        estimated: round(mean(withEstimated.map((task) => task.estimatedDurationMinutes ?? 0)), 2),
        actual: round(mean(withActual.map((task) => task.actualDurationMinutes ?? 0)), 2),
      },
      byCategory: durationByCategory,
    },
    efficiencyScore,
    peakHours,
    usage: {
      priorityTasks: tasks.filter((task) => task.priority != null).length,
      durationTasks: durationTasks.length,
    },
  };
}

// ─── Section 15.11: Incomplete & Missed Tasks ─────────────────────────────────

export type MissedTaskItem = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  color: string;
  priority: Priority | null;
  dueDate: string | null;
  assignedDate: string;
  daysOverdue: number;
};

export function buildMissedTasks(
  tasks: TaskWithRelations[],
  categories: Category[],
  from: Date,
  to: Date,
  timezone: string,
) {
  const built = buildBuckets(tasks, categories, from, to, timezone);
  const today = todayKey(timezone);
  const now = new Date();

  // Every incomplete task whose assigned day is today or earlier counts as missed.
  // Today's entries are "incomplete"; past entries are "missed".
  const missed: MissedTaskItem[] = tasks
    .filter((task) => !task.completedAt)
    .map((task) => ({ task, assignedDate: bucketDate(task.dueDate, task.createdAt, timezone) }))
    .filter(({ assignedDate }) => assignedDate <= today)
    .sort((a, b) => b.assignedDate.localeCompare(a.assignedDate) || a.task.title.localeCompare(b.task.title))
    .map(({ task, assignedDate }) => ({
      id: task.id,
      title: task.title,
      categoryId: task.categoryId,
      categoryName: task.category.name,
      color: task.category.color,
      priority: task.priority,
      dueDate: task.dueDate ? getDateKey(task.dueDate, timezone) : null,
      assignedDate,
      daysOverdue: compareDateKeys(today, assignedDate),
    }));

  const fromKey = getDateKey(from, timezone);
  const missedInRange = missed.filter((item) => item.assignedDate >= fromKey);

  return {
    series: built.daily.map((day) => ({
      date: day.date,
      assigned: day.assigned,
      completed: day.completed,
      incomplete: day.incomplete,
    })),
    missed,
    totals: {
      assigned: built.cohort.assigned,
      completed: built.cohort.completed,
      incomplete: built.cohort.incomplete,
      missed: missedInRange.length,
      missedRate: built.cohort.assigned === 0 ? 0 : round((built.cohort.incomplete / built.cohort.assigned) * 100, 2),
    },
    missedToday: missed.filter((item) => item.daysOverdue === 0).length,
    overdueNow: missed.filter((item) => item.daysOverdue > 0).length,
    generatedAt: now.toISOString(),
  };
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function buildDashboardData(tasks: TaskWithRelations[], categories: Category[], timezone: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 364);

  const today = todayKey(timezone);
  const trailingYear = buildCompletionRates(tasks, categories, oneYearAgo, now, timezone);
  const trailingMonth = buildCompletionRates(tasks, categories, thirtyDaysAgo, now, timezone);
  const todayBucket = trailingYear.daily.find((day) => day.date === today) ?? {
    date: today,
    assigned: 0,
    completed: 0,
    incomplete: 0,
    completionRate: 0,
    categories: {},
  };
  const streaks = buildStreaks(tasks, categories, oneYearAgo, now, timezone);
  const categorySummary = buildAssignedVsCompleted(tasks, categories, thirtyDaysAgo, now, timezone).categories;
  const missed = buildMissedTasks(tasks, categories, oneYearAgo, now, timezone);

  return {
    kpis: {
      todayCompletionRate: todayBucket.completionRate,
      tasksDueToday: todayBucket.assigned,
      tasksCompletedToday: todayBucket.completed,
      tasksRemainingToday: Math.max(0, todayBucket.assigned - todayBucket.completed),
      missedTasks: missed.missed.length,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak.length,
      longestStreakEnd: streaks.longestStreak.endDate,
    },
    heatmap: trailingYear.daily,
    trend: trailingMonth.daily,
    categorySummary: categorySummary.slice(0, 8),
    missedTasks: missed.missed.slice(0, 20),
  };
}

export function buildCalendarMonth(tasks: TaskWithRelations[], categories: Category[], from: Date, to: Date, timezone: string) {
  return buildCompletionRates(tasks, categories, from, to, timezone).daily;
}

export function buildCalendarDay(tasks: TaskWithRelations[], categories: Category[], date: Date, timezone: string) {
  const from = new Date(date);
  const to = new Date(date);
  const completion = buildCompletionRates(tasks, categories, from, to, timezone).daily[0];
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const yearEnd = new Date(date.getFullYear(), 11, 31);
  const streaks = buildStreaks(tasks, categories, yearStart, yearEnd, timezone);
  return {
    summary: completion,
    streaks,
    tasks: tasks.filter((task) => bucketDate(task.dueDate, task.createdAt, timezone) === getDateKey(date, timezone)),
  };
}

export function buildRecentActivity(tasks: TaskWithRelations[]) {
  return tasks
    .flatMap((task) => [
      { id: `${task.id}-created`, type: "TASK_CREATED", title: task.title, category: task.category.name, at: task.createdAt },
      ...(task.completedAt
        ? [{ id: `${task.id}-completed`, type: "TASK_COMPLETED", title: task.title, category: task.category.name, at: task.completedAt }]
        : []),
    ])
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);
}

export function buildWeeklyGroups(from: Date, to: Date) {
  return eachWeekOfInterval({ start: from, end: to }).map((date) => ({
    label: format(startOfWeek(date), "yyyy-MM-dd"),
  }));
}

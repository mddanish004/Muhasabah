"use client";

import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type HeatmapDay = { date: string; completionRate: number };
type WeekColumn = Array<HeatmapDay | null>;

type DashboardData = {
  kpis: {
    todayCompletionRate: number;
    tasksDueToday: number;
    tasksCompletedToday: number;
    tasksRemainingToday: number;
    currentStreak: number;
    longestStreak: number;
  };
  trend: Array<{ date: string; completionRate: number }>;
  heatmap: HeatmapDay[];
  categorySummary: Array<{
    categoryId: string;
    categoryName: string;
    color: string;
    completionRate: number;
    assigned: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    category: string;
    at: string;
  }>;
};

// ─── Heatmap helpers ─────────────────────────────────────────────────────────

function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getHeatmapColor(rate: number): string {
  if (rate <= 0) return "rgba(74,222,128,0.06)";
  if (rate < 25) return "rgba(74,222,128,0.22)";
  if (rate < 50) return "rgba(74,222,128,0.42)";
  if (rate < 75) return "rgba(74,222,128,0.65)";
  return "rgba(74,222,128,0.9)";
}

function buildHeatmapWeeks(days: HeatmapDay[]): WeekColumn[] {
  if (days.length === 0) return [];

  const firstDate = parseDateLocal(days[0].date);
  const startOffset = (firstDate.getDay() + 6) % 7; // Mon=0, Sun=6

  const weeks: WeekColumn[] = [];
  let current: Array<HeatmapDay | null> = Array.from(
    { length: startOffset },
    () => null,
  );

  for (const day of days) {
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  return weeks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: typeof Flame;
  label: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.06em]">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-[var(--text-secondary)]">{subtitle}</div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { data, isLoading } = useDashboardQuery();

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (!data) return null;
  const d = data as DashboardData;

  if (d.categorySummary.length === 0) {
    return (
      <EmptyState
        title="Nothing tracked yet"
        description="Create a category, then add your first task to start seeing your productivity data."
        action={
          <Link href="/categories" className="text-sm text-[var(--accent)]">
            Create your first category
          </Link>
        }
      />
    );
  }

  const heatmapWeeks = buildHeatmapWeeks(d.heatmap);

  return (
    <div className="grid gap-6">
      {/* Row 1: Today's progress + streak KPIs */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <Card className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-4">
            <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
              Today&apos;s Progress
            </div>
            <div className="mt-3 text-4xl font-bold">
              {d.kpis.tasksCompletedToday} / {d.kpis.tasksDueToday}
            </div>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">
              Tasks completed vs assigned for {todayLabel}.
            </div>
          </div>
          <ProgressRing value={d.kpis.todayCompletionRate} label="today" />
        </Card>
        <KpiCard
          icon={Flame}
          label="Current Streak"
          value={d.kpis.currentStreak}
          subtitle="days with at least one completion"
        />
        <KpiCard
          icon={Target}
          label="Longest Streak"
          value={d.kpis.longestStreak}
          subtitle="best run recorded so far"
        />
      </div>

      {/* Row 2: Task KPIs */}
      <div className="grid gap-4 xl:grid-cols-3">
        <KpiCard
          icon={CalendarDays}
          label="Tasks Due Today"
          value={d.kpis.tasksDueToday}
          subtitle="scheduled for today"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Completed Today"
          value={d.kpis.tasksCompletedToday}
          subtitle="finished since midnight"
        />
        <KpiCard
          icon={Clock}
          label="Tasks Remaining"
          value={d.kpis.tasksRemainingToday}
          subtitle="still open before end of day"
        />
      </div>

      {/* Trend + Category */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">30-Day Completion Trend</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Daily completion percentage across the trailing 30 days.
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.trend}>
                <defs>
                  <linearGradient id="dashTrendFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--text-tertiary)"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  stroke="var(--text-tertiary)"
                  tick={{ fontSize: 10 }}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface-2)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v ?? 0}%`, "Completion"]}
                />
                <Area
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#4ade80"
                  fill="url(#dashTrendFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Category Summary</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Sorted by completion rate.</p>
          <div className="mt-4 space-y-3">
            {d.categorySummary.map((category) => (
              <Link
                key={category.categoryId}
                href={`/categories/${category.categoryId}`}
                className="block rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3 transition hover:bg-[var(--bg-surface-2)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm">{category.categoryName}</span>
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {category.completionRate}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--bg-surface-3)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{ width: `${Math.max(category.completionRate, 4)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[var(--text-secondary)]">
                  {category.assigned} tasks in range
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Heatmap + Recent Activity */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="text-lg font-semibold">Contribution Heatmap</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Year view of your daily completion intensity.
          </p>
          <div className="mt-4 overflow-x-auto pb-2">
            {heatmapWeeks.length > 0 && (
              <div style={{ display: "inline-flex", alignItems: "flex-start", gap: 0 }}>
                {/* Day-of-week label column */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    paddingTop: 20,
                    marginRight: 4,
                    flexShrink: 0,
                  }}
                >
                  {["M", "", "W", "", "F", "", "S"].map((label, i) => (
                    <div
                      key={i}
                      style={{
                        width: 10,
                        height: 13,
                        fontSize: 9,
                        lineHeight: "13px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Week columns + month labels */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {/* Month labels row */}
                  <div style={{ display: "flex", gap: 2 }}>
                    {heatmapWeeks.map((week, wi) => {
                      const firstCell = week.find((c) => c !== null);
                      if (!firstCell) return <div key={wi} style={{ width: 13 }} />;
                      const cellDate = parseDateLocal(firstCell.date);
                      const prevWeek = wi > 0 ? heatmapWeeks[wi - 1] : null;
                      const prevCell = prevWeek?.find((c) => c !== null);
                      const showLabel =
                        !prevCell ||
                        parseDateLocal(prevCell.date).getMonth() !== cellDate.getMonth();
                      return (
                        <div
                          key={wi}
                          style={{
                            width: 13,
                            height: 14,
                            fontSize: 9,
                            color: "var(--text-tertiary)",
                            overflow: "visible",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {showLabel
                            ? cellDate.toLocaleDateString("en-US", { month: "short" })
                            : ""}
                        </div>
                      );
                    })}
                  </div>

                  {/* Week cell columns */}
                  <div style={{ display: "flex", gap: 2 }}>
                    {heatmapWeeks.map((week, wi) => (
                      <div
                        key={wi}
                        style={{ display: "flex", flexDirection: "column", gap: 2 }}
                      >
                        {week.map((cell, di) => (
                          <Link
                            key={di}
                            href={cell ? `/calendar?date=${cell.date}` : "#"}
                            title={
                              cell
                                ? `${cell.date}: ${cell.completionRate}%`
                                : undefined
                            }
                            className={cn(
                              "block transition",
                              cell && "hover:ring-1 hover:ring-[var(--accent)]",
                            )}
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: 2,
                              backgroundColor: cell
                                ? getHeatmapColor(cell.completionRate)
                                : "transparent",
                              border: cell
                                ? "1px solid rgba(74,222,128,0.12)"
                                : undefined,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] text-[var(--text-tertiary)]">Less</span>
              {[0, 20, 45, 65, 100].map((rate, i) => (
                <div
                  key={i}
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 2,
                    backgroundColor: getHeatmapColor(rate),
                    border: "1px solid rgba(74,222,128,0.12)",
                  }}
                />
              ))}
              <span className="text-[10px] text-[var(--text-tertiary)]">More</span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Latest creation and completion events.
          </p>
          <div className="mt-4 space-y-3">
            {d.recentActivity.map((item) => (
              <div
                key={item.id}
                className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"
              >
                <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <Activity className="h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{item.title}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {item.type} · {item.category}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

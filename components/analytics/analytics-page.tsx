"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnalyticsSection } from "@/hooks/useAnalyticsSection";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "this-month" | "this-year";

interface DailyBucket {
  date: string;
  assigned: number;
  completed: number;
  incomplete: number;
  completionRate: number;
}

interface CompletionRatesData {
  overallCompletionRate: number;
  overallRateDelta: number | null;
  totals: { assigned: number; completed: number };
  byWeekday: Array<{ weekday: string; completionRate: number }>;
  byMonth: Array<{ month: string; completionRate: number }>;
  current: { daily: number; weekly: number; monthly: number; yearly: number };
  daily: DailyBucket[];
}

interface AssignedVsCompletedData {
  granularity: "daily" | "weekly" | "monthly";
  series: Array<{ date: string; assigned: number; completed: number; incomplete: number }>;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    color?: string;
    assigned: number;
    completed: number;
    incomplete: number;
    completionRate: number;
  }>;
  radar: Array<{ categoryName: string; completionRate: number }>;
}

interface TrendsData {
  completionTrend: DailyBucket[];
  rolling7: Array<{ date: string; value: number }>;
  rolling30: Array<{ date: string; value: number }>;
  rolling90: Array<{ date: string; value: number }>;
  cumulative: Array<{ date: string; value: number }>;
  creationTrend: Array<{ date: string; count: number }>;
  completionCountTrend: Array<{ date: string; count: number }>;
  rollingAverages: { r7: number; r30: number; r90: number; deltas: { r7: number | null; r30: number | null; r90: number | null } };
  forecast: Array<{ date: string; value: number; lower: number; upper: number }>;
}

interface ScoreInputs {
  completionRate: number;
  priorCompletionRate: number;
  completedPerDay: number;
  personalBestCompletedPerDay: number;
  stdDevDailyRates: number;
  topCategoryName: string | null;
  totalCompleted: number;
  totalAssigned: number;
  overdueIncomplete: number;
  daysWithCompletion: number;
  totalDays: number;
  rolling7: number;
  rolling30: number;
  recoveryAverage: number | null;
  durationTaskCount: number;
}

interface ScoresData {
  productivityScore: number;
  consistencyScore: number;
  focusScore: number;
  taskDisciplineScore: number;
  habitScore: number;
  momentumScore: number;
  recoveryScore: number | null;
  efficiencyScore: number | null;
  selfImprovementScore: number;
  accountabilityIndex: number;
  personalWorkloadIndex: number;
  inputs: ScoreInputs;
}

interface StreakSegment {
  start: string;
  end: string;
  length: number;
}

interface StreaksData {
  currentStreak: number;
  longestStreak: { length: number; endDate: string };
  averageStreakLength: number;
  medianStreakLength: number;
  streakDistribution: Array<{ bucket: string; count: number }>;
  brokenStreaks: Array<{ brokeOn: string; length: number; daysToNext: number }>;
  streakSegments: StreakSegment[];
  categoryStreaks: Array<{ categoryId: string; categoryName: string; color: string; current: number; longest: number }>;
  perfectDays: number;
  perfectDayDates: string[];
  perfectWeeks: Array<{ start: string; end: string }>;
  perfectMonths: string[];
  longestProductivePeriod: { length: number; start: string; end: string };
  missedDays: number;
  timeline: DailyBucket[];
}

interface CategoryRankRow {
  categoryId: string;
  categoryName: string;
  color: string;
  assigned: number;
  completed: number;
  completionRate: number;
  trend: number;
  consistency: number;
  saturation: number;
  momentum: number;
  currentStreak: number;
  longestStreak: number;
}

interface CategoryDeepDiveData {
  ranking: CategoryRankRow[];
  best: CategoryRankRow | null;
  worst: CategoryRankRow | null;
  balance: number | null;
  saturation: Array<{ categoryId: string; categoryName: string; color: string; pct: number }>;
}

interface PeriodComparison {
  current: { rate: number; assigned: number; completed: number };
  previous: { rate: number; assigned: number; completed: number };
  delta: { rate: number; assigned: number; completed: number };
}

interface TimeComparisonsData {
  weekly: PeriodComparison;
  monthly: PeriodComparison;
  quarterly: PeriodComparison;
  yearly: PeriodComparison;
}

interface DistributionData {
  taskFrequency: Array<{ label: string; count: number }>;
  completionHistogram: Array<{ bucket: string; count: number }>;
  volumeTrend: Array<{ label: string; assigned: number }>;
  taskDensity: Array<{ categoryId: string; categoryName: string; color: string; perWeek: number }>;
  completionDistribution: Array<Record<string, unknown>>;
  averages: { assigned: number; completed: number };
  pendingCount: number;
  backlogTrend: Array<{ date: string; count: number }>;
  velocity: number | null;
}

interface AgingTask {
  id: string;
  title: string;
  category: string;
  daysOverdue: number;
  priority: string | null;
  probability: "low" | "medium" | "high";
}

interface AgingData {
  overdue: AgingTask[];
  aging: Array<{ bucket: string; count: number }>;
  completionLag: { average: number; histogram: Array<{ bucket: string; count: number }> };
}

interface PriorityDurationData {
  byPriority: Array<{ priority: string; total: number; completionRate: number }>;
  duration: {
    overall: { estimated: number; actual: number };
    byCategory: Array<{ categoryId: string; categoryName: string; estimated: number; actual: number }>;
  };
  efficiencyScore: number | null;
  peakHours: Array<{ hour: number; count: number }> | null;
  usage: { priorityTasks: number; durationTasks: number };
}

interface MissedTaskItem {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  color: string;
  priority: string | null;
  dueDate: string | null;
  assignedDate: string;
  daysOverdue: number;
}

interface MissedTasksData {
  series: Array<{ date: string; assigned: number; completed: number; incomplete: number }>;
  missed: MissedTaskItem[];
  totals: { assigned: number; completed: number; incomplete: number; missed: number; missedRate: number };
  missedToday: number;
  overdueNow: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGES: { label: string; value: Range }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "This Month", value: "this-month" },
  { label: "This Year", value: "this-year" },
];

const SCORE_META: Record<string, { label: string; description: string; formula: string; inputs: Array<{ key: keyof ScoreInputs; label: string }> }> = {
  productivityScore: {
    label: "Productivity",
    description: "Rewards both completion rate and raw volume, weighted toward rate.",
    formula: "0.6 × completionRate + 0.4 × (completedPerDay ÷ personalBest)",
    inputs: [
      { key: "completionRate", label: "Completion rate" },
      { key: "completedPerDay", label: "Avg completed/day" },
      { key: "personalBestCompletedPerDay", label: "Personal best/day" },
    ],
  },
  consistencyScore: {
    label: "Consistency",
    description: "Low variance in daily completion % = high consistency.",
    formula: "100 − stdDev(dailyCompletionRate)",
    inputs: [
      { key: "stdDevDailyRates", label: "Std dev of daily rates" },
      { key: "totalDays", label: "Days in range" },
    ],
  },
  focusScore: {
    label: "Focus",
    description: "How concentrated effort is in one category. Higher isn't always better — it's descriptive, not prescriptive.",
    formula: "topCategoryCompletions ÷ totalCompleted × 100",
    inputs: [
      { key: "topCategoryName", label: "Top category" },
      { key: "totalCompleted", label: "Total completed" },
    ],
  },
  taskDisciplineScore: {
    label: "Task Discipline",
    description: "Penalizes tasks that passed their due date while still incomplete.",
    formula: "100 − (overdueIncomplete ÷ totalAssigned) × 100",
    inputs: [
      { key: "overdueIncomplete", label: "Overdue incomplete" },
      { key: "totalAssigned", label: "Total assigned" },
    ],
  },
  habitScore: {
    label: "Habit",
    description: "Did you do something every day, independent of full completion?",
    formula: "daysWithCompletion ÷ totalDays × 100",
    inputs: [
      { key: "daysWithCompletion", label: "Days with ≥1 completion" },
      { key: "totalDays", label: "Total days" },
    ],
  },
  momentumScore: {
    label: "Momentum",
    description: "Recent 7-day average vs the 30-day baseline. 50 = flat, above = accelerating.",
    formula: "(rolling7 − rolling30) + 50",
    inputs: [
      { key: "rolling7", label: "7-day avg rate" },
      { key: "rolling30", label: "30-day avg rate" },
    ],
  },
  recoveryScore: {
    label: "Recovery",
    description: "How quickly you return to ≥1 completed task after a 0-completion day.",
    formula: "100 − (avgDaysToRecover − 1) × 25",
    inputs: [{ key: "recoveryAverage", label: "Avg recovery days" }],
  },
  efficiencyScore: {
    label: "Efficiency",
    description: "Estimation accuracy, not speed. Only counts tasks with both estimated and actual duration.",
    formula: "100 − avg(│actual − estimated│ ÷ estimated) × 100",
    inputs: [{ key: "durationTaskCount", label: "Tasks with duration data" }],
  },
  selfImprovementScore: {
    label: "Self-Improvement",
    description: "This period vs the immediately preceding equal-length period. 50 = flat.",
    formula: "(completionRate − priorCompletionRate) + 50",
    inputs: [
      { key: "completionRate", label: "This period rate" },
      { key: "priorCompletionRate", label: "Prior period rate" },
    ],
  },
  accountabilityIndex: {
    label: "Accountability",
    description: "Composite of the three 'did you show up and follow through' signals.",
    formula: "0.5 × discipline + 0.3 × habit + 0.2 × consistency",
    inputs: [
      { key: "overdueIncomplete", label: "Overdue incomplete" },
      { key: "daysWithCompletion", label: "Days with ≥1 completion" },
      { key: "stdDevDailyRates", label: "Std dev of daily rates" },
    ],
  },
};

const SCORE_KEYS = [
  "productivityScore",
  "consistencyScore",
  "focusScore",
  "taskDisciplineScore",
  "habitScore",
  "momentumScore",
  "recoveryScore",
  "efficiencyScore",
  "selfImprovementScore",
] as const;

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "var(--success)",
  MEDIUM: "var(--info)",
  HIGH: "var(--warning)",
  URGENT: "var(--danger)",
};

const PROBABILITY_META = {
  low: { label: "Low", className: "bg-[var(--bg-surface-2)] text-[var(--text-secondary)] border-[var(--border-subtle)]" },
  medium: { label: "Medium", className: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30" },
  high: { label: "High", className: "bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30" },
} as const;

const TOOLTIP_STYLE = {
  background: "var(--bg-surface-2)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
} as const;

const STORAGE_KEY = "muhasabah:analytics:collapsed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n}${suffix}`;
}

function deltaColor(d: number): string {
  if (d > 0) return "text-emerald-400";
  if (d < 0) return "text-[var(--danger)]";
  return "text-[var(--text-secondary)]";
}

function deltaPrefix(d: number): string {
  return d > 0 ? "+" : "";
}

function deltaArrow(d: number): string {
  return d > 0 ? "↑" : d < 0 ? "↓" : "→";
}

function tickLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.length >= 10 ? value.slice(5) : value.slice(5);
}

function workloadBadge(index: number): { label: string; className: string } {
  if (index < 2) return { label: "Light", className: "text-emerald-400" };
  if (index <= 5) return { label: "Moderate", className: "text-[var(--info)]" };
  if (index <= 9) return { label: "Heavy", className: "text-[var(--warning)]" };
  return { label: "Overloaded", className: "text-[var(--danger)]" };
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function SectionShell({
  id,
  title,
  note,
  collapsedMap,
  onToggle,
  defaultCollapsed = false,
  children,
}: {
  id: string;
  title: string;
  note?: React.ReactNode;
  collapsedMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const collapsed = collapsedMap[id] ?? defaultCollapsed;

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
        )}
      </button>
      {collapsed ? (
        note ? (
          <div className="px-6 pb-6 text-sm text-[var(--text-secondary)]">{note}</div>
        ) : null
      ) : (
        <div className="px-6 pb-6">{children}</div>
      )}
    </Card>
  );
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
      <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {sub ? <div className="mt-1 text-xs text-[var(--text-tertiary)]">{sub}</div> : null}
    </div>
  );
}

function SkeletonBlock({ height = "h-72" }: { height?: string }) {
  return <Skeleton className={cn("w-full", height)} />;
}

function ChartWrap({ title, children, minHeight = "h-[280px]" }: { title: string; children: React.ReactNode; minHeight?: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      <div className={cn("w-full", minHeight)}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <span
        role="img"
        aria-label="Formula details"
        className="cursor-help text-xs text-[var(--text-tertiary)] transition hover:text-[var(--text-secondary)]"
      >
        ⓘ
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-3)] p-3 text-xs leading-relaxed text-[var(--text-secondary)] shadow-lg group-hover:block group-focus-within:block">
        {children}
      </span>
    </span>
  );
}

function GaugeScore({ value, label, children }: { value: number | null; label: string; children?: React.ReactNode }) {
  const v = value ?? 0;
  const clamped = Math.max(0, Math.min(100, v));
  const R = 46;
  const arcLen = Math.PI * R;
  const offset = arcLen * (1 - clamped / 100);
  const arc = `M 14 58 A 46 46 0 0 1 106 58`;

  return (
    <div className="flex flex-col items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
      <div className="flex w-full items-center justify-end">
        {children}
      </div>
      <svg viewBox="0 0 120 64" className="w-full max-w-[170px]">
        <path d={arc} stroke="var(--border-subtle)" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path
          d={arc}
          stroke="var(--accent)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={offset}
        />
        <text
          x="60"
          y="58"
          textAnchor="middle"
          style={{ fill: "var(--text-primary)" }}
          fontSize="22"
          fontWeight="700"
        >
          {value === null ? "—" : Math.round(value)}
        </text>
      </svg>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function ScoreCard({ scoreKey, data }: { scoreKey: string; data: ScoresData }) {
  const meta = SCORE_META[scoreKey];
  const value = data[scoreKey as keyof ScoresData] as number | null;

  if (scoreKey === "efficiencyScore" && value === null) return null;

  return (
    <GaugeScore value={value} label={meta.label}>
      <InfoTip>
        <p>{meta.description}</p>
        <p className="mt-1 font-mono text-[11px] text-[var(--text-primary)]">{meta.formula}</p>
        <ul className="mt-2 space-y-0.5">
          {meta.inputs.map((input) => (
            <li key={input.key} className="flex justify-between gap-2">
              <span>{input.label}</span>
              <span className="font-medium text-[var(--text-primary)]">
                {input.key === "topCategoryName"
                  ? (data.inputs.topCategoryName ?? "—")
                  : fmt(data.inputs[input.key])}
              </span>
            </li>
          ))}
        </ul>
      </InfoTip>
    </GaugeScore>
  );
}

function ExpandableList({ title, items, format }: { title: string; items: string[]; format?: (item: string) => string }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-[var(--text-secondary)] underline decoration-dotted underline-offset-2 transition hover:text-[var(--text-primary)]"
      >
        {title} ({items.length}) {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
            >
              {format ? format(item) : item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useCollapsedSections() {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });

  const toggle = (id: string) => {
    setCollapsedMap((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? false) };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — ignore
      }
      return next;
    });
  };

  return { collapsedMap, toggle };
}

// ─── Section 15.1: Completion Rates ───────────────────────────────────────────

function CompletionRatesSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("completion-rates", { range, categories });
  const d = data as CompletionRatesData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonBlock height="h-16" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height="h-24" />)}
        </div>
        <SkeletonBlock height="h-[280px]" />
        <SkeletonBlock height="h-[280px]" />
      </div>
    );
  }

  if (!d) {
    return <EmptyState title="No data" description="No completion data for this range." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-6xl font-bold">{d.overallCompletionRate}%</span>
        <div className="text-sm">
          <span className="text-[var(--text-secondary)]">overall completion rate</span>
          {d.overallRateDelta !== null && (
            <span className={cn("ml-2 font-medium", deltaColor(d.overallRateDelta))}>
              {deltaArrow(d.overallRateDelta)} {deltaPrefix(d.overallRateDelta)}{d.overallRateDelta} pts vs prior period
            </span>
          )}
          <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
            {d.totals.completed} of {d.totals.assigned} tasks completed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Today" value={`${fmt(d.current?.daily)}%`} />
        <StatTile label="This Week" value={`${fmt(d.current?.weekly)}%`} />
        <StatTile label="This Month" value={`${fmt(d.current?.monthly)}%`} />
        <StatTile label="This Year" value={`${fmt(d.current?.yearly)}%`} />
      </div>

      {d.byWeekday.length === 0 ? (
        <EmptyState title="No weekday data" description="No weekday breakdown available for this range." />
      ) : (
        <ChartWrap title="Completion by Weekday">
          <BarChart data={d.byWeekday} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="weekday" stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Completion Rate"]} />
            <Bar dataKey="completionRate" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrap>
      )}

      {d.byMonth.length === 0 ? (
        <EmptyState title="No monthly data" description="No monthly breakdown available for this range." />
      ) : (
        <ChartWrap title="Completion by Month">
          <BarChart data={d.byMonth} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Completion Rate"]} />
            <Bar dataKey="completionRate" fill="var(--info)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrap>
      )}
    </div>
  );
}

// ─── Section 15.2: Assigned vs. Completed ─────────────────────────────────────

function AssignedVsCompletedSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("assigned-vs-completed", { range, categories });
  const d = data as AssignedVsCompletedData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock height="h-[280px]" />
        <SkeletonBlock height="h-[280px]" />
      </div>
    );
  }

  if (!d || (d.series.length === 0 && d.categories.length === 0)) {
    return <EmptyState title="No data" description="No assigned or completed tasks for this range." />;
  }

  const catRows = d.categories.map((category) => ({ ...category, totalBar: 100 }));
  const radarData = d.radar.length > 0 ? d.radar : null;

  return (
    <div className="space-y-6">
      <ChartWrap title={`Assigned vs. Completed (${d.granularity})`}>
        <ComposedChart data={d.series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
          <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="assigned" name="Assigned" fill="var(--info)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="incomplete" name="Incomplete" fill="var(--warning)" radius={[3, 3, 0, 0]} />
        </ComposedChart>
      </ChartWrap>

      {catRows.length === 0 ? (
        <EmptyState title="No category data" description="No categories with tasks in this range." />
      ) : (
        <ChartWrap title="Completion Rate by Category">
          <BarChart data={catRows} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="categoryName" width={110} stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name) => (name === "totalBar" ? null : [`${v}%`, "Completion Rate"])}
            />
            <Bar dataKey="totalBar" name="scale" fill="var(--border-default)" barSize={16} />
            <Bar dataKey="completionRate" name="Completion" barSize={16}>
              {catRows.map((row) => (
                <Cell key={row.categoryId} fill={row.color ?? "var(--accent)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartWrap>
      )}

      {radarData ? (
        <ChartWrap title="Category Comparison Radar">
          <RadarChart data={radarData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <PolarGrid stroke="var(--border-subtle)" />
            <PolarAngleAxis dataKey="categoryName" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} />
            <PolarRadiusAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Completion Rate"]} />
            <Radar dataKey="completionRate" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
          </RadarChart>
        </ChartWrap>
      ) : (
        <EmptyState title="No radar data" description="No categories with completions in this range." />
      )}
    </div>
  );
}

// ─── Section 15.2b: Incomplete & Missed Tasks ─────────────────────────────────

function MissedTasksSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("missed-tasks", { range, categories });
  const d = data as MissedTasksData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height="h-24" />)}
        </div>
        <SkeletonBlock height="h-[280px]" />
        <SkeletonBlock height="h-72" />
      </div>
    );
  }

  if (!d) {
    return <EmptyState title="No data" description="No task data for this range." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Missed Today" value={d.missedToday} sub="due today, still incomplete" />
        <StatTile label="Overdue Now" value={d.overdueNow} sub="missed on past days, still open" />
        <StatTile label="Missed in Range" value={d.totals.missed} sub="missed on days inside this range" />
        <StatTile label="Missed Rate" value={fmt(d.totals.missedRate, "%")} sub="incomplete ÷ assigned in range" />
      </div>

      <ChartWrap title="Assigned, Completed & Incomplete by Day">
        <ComposedChart data={d.series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
          <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="assigned" name="Assigned" fill="var(--info)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="incomplete" name="Incomplete" fill="var(--warning)" radius={[3, 3, 0, 0]} />
        </ComposedChart>
        <p className="mt-1 text-xs italic text-[var(--text-tertiary)]">
          Incomplete = tasks assigned to that day that are still open today. For past days this equals missed.
        </p>
      </ChartWrap>

      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Missed &amp; Incomplete Tasks</p>
        {d.missed.length === 0 ? (
          <EmptyState title="Nothing missed" description="All tasks are either completed or not yet due." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  <th className="pb-3 text-left font-medium">Task</th>
                  <th className="pb-3 text-left font-medium">Category</th>
                  <th className="pb-3 text-right font-medium">Due</th>
                  <th className="pb-3 text-right font-medium">Overdue</th>
                  <th className="pb-3 text-right font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {d.missed.map((task) => (
                  <tr key={task.id} className="group">
                    <td className="py-3 text-[var(--text-primary)]">{task.title}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: task.color }} />
                        {task.categoryName}
                      </span>
                    </td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">
                      {task.dueDate ?? "—"}
                    </td>
                    <td className={cn("py-3 text-right font-medium", task.daysOverdue > 0 ? "text-[var(--danger)]" : "text-[var(--warning)]")}>
                      {task.daysOverdue === 0 ? "today" : `${task.daysOverdue}d`}
                    </td>
                    <td className={cn("py-3 text-right capitalize", PRIORITY_COLOR[task.priority?.toUpperCase() ?? ""] ?? "text-[var(--text-secondary)]")}>
                      {task.priority ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section 15.3: Trends ─────────────────────────────────────────────────────

function TrendsSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("trends", { range, categories });
  const d = data as TrendsData | undefined;
  const [overlays, setOverlays] = useState({ r7: true, r30: false, r90: false });

  const merged = useMemo(() => {
    if (!d) return [];
    const byDate = new Map<string, Record<string, number>>();
    for (const day of d.completionTrend) {
      byDate.set(day.date, { ...byDate.get(day.date), completionRate: day.completionRate });
    }
    for (const series of [
      { key: "rolling7", items: d.rolling7 },
      { key: "rolling30", items: d.rolling30 },
      { key: "rolling90", items: d.rolling90 },
    ]) {
      for (const item of series.items) {
        byDate.set(item.date, { ...byDate.get(item.date), [series.key]: item.value });
      }
    }
    for (const point of d.forecast) {
      byDate.set(point.date, {
        ...byDate.get(point.date),
        forecast: point.value,
        bandLower: point.lower,
        bandUpper: point.upper,
      });
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [d]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock height="h-[320px]" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <SkeletonBlock key={i} height="h-24" />)}
        </div>
        <SkeletonBlock height="h-[280px]" />
      </div>
    );
  }

  if (!d || d.completionTrend.length === 0) {
    return <EmptyState title="No trend data" description="No trend data for this range." />;
  }

  const overlayToggle = (key: keyof typeof overlays) => () => setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));

  const rollingCards = [
    { key: "r7", label: "7-Day Avg", value: d.rollingAverages.r7, delta: d.rollingAverages.deltas.r7, data: d.rolling7 },
    { key: "r30", label: "30-Day Avg", value: d.rollingAverages.r30, delta: d.rollingAverages.deltas.r30, data: d.rolling30 },
    { key: "r90", label: "90-Day Avg", value: d.rollingAverages.r90, delta: d.rollingAverages.deltas.r90, data: d.rolling90 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Completion Trend</p>
          <div className="flex gap-3 text-xs text-[var(--text-secondary)]">
            {(["r7", "r30", "r90"] as const).map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={overlays[key]}
                  onChange={overlayToggle(key)}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                {key.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merged} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
              <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="bandLower" stackId="band" stroke="none" fill="var(--accent)" fillOpacity={0.12} connectNulls={false} />
              <Area type="monotone" dataKey="bandUpper" stackId="band" stroke="none" fillOpacity={0} connectNulls={false} />
              <Area type="monotone" dataKey="completionRate" name="Completion Rate" stroke="var(--accent)" fill="url(#trendGrad)" strokeWidth={2} dot={false} />
              {overlays.r7 && <Line type="monotone" dataKey="rolling7" name="7-Day Avg" stroke="var(--info)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />}
              {overlays.r30 && <Line type="monotone" dataKey="rolling30" name="30-Day Avg" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="8 3" dot={false} />}
              {overlays.r90 && <Line type="monotone" dataKey="rolling90" name="90-Day Avg" stroke="var(--success)" strokeWidth={1.5} strokeDasharray="10 4" dot={false} />}
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs italic text-[var(--text-tertiary)]">Forecast: Projected, not guaranteed — linear regression ± residual std dev.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {rollingCards.map((card) => (
          <div key={card.key} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">{card.label}</div>
                <div className="mt-1 text-3xl font-bold">{fmt(card.value)}%</div>
              </div>
              {card.delta !== null && (
                <div className={cn("text-sm font-medium", deltaColor(card.delta))}>
                  {deltaArrow(card.delta)} {deltaPrefix(card.delta)}{card.delta} pts
                </div>
              )}
            </div>
            <div className="mt-2 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={card.data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`sparkGrad${card.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" fill={`url(#sparkGrad${card.key})`} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <ChartWrap title="Cumulative Completions">
        <AreaChart data={d.cumulative} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
          <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Completed"]} />
          <Area type="stepAfter" dataKey="value" stroke="var(--success)" fill="var(--success)" fillOpacity={0.15} strokeWidth={2} dot={false} />
        </AreaChart>
      </ChartWrap>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrap title="Tasks Created">
          <AreaChart data={d.creationTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Created"]} />
            <Area type="monotone" dataKey="count" stroke="var(--info)" fill="var(--info)" fillOpacity={0.15} dot={false} />
          </AreaChart>
        </ChartWrap>
        <ChartWrap title="Tasks Completed (count)">
          <AreaChart data={d.completionCountTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Completed"]} />
            <Area type="monotone" dataKey="count" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.15} dot={false} />
          </AreaChart>
        </ChartWrap>
      </div>
    </div>
  );
}

// ─── Section 15.4: Scores ─────────────────────────────────────────────────────

function ScoresSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("scores", { range, categories });
  const d = data as ScoresData | undefined;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(9)].map((_, i) => <SkeletonBlock key={i} height="h-40" />)}
      </div>
    );
  }

  if (!d) {
    return <EmptyState title="No data" description="No score data for this range." />;
  }

  const badge = workloadBadge(d.personalWorkloadIndex);

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--bg-surface-2)] p-6">
        <div className="flex flex-wrap items-center gap-6">
          <GaugeScore value={d.accountabilityIndex} label="Accountability Index">
            <InfoTip>
              <p>{SCORE_META.accountabilityIndex.description}</p>
              <p className="mt-1 font-mono text-[11px] text-[var(--text-primary)]">{SCORE_META.accountabilityIndex.formula}</p>
            </InfoTip>
          </GaugeScore>
          <div className="max-w-md text-sm text-[var(--text-secondary)]">
            <p>
              The composite meta-score combining the three most{" "}
              <em>&ldquo;did you show up and follow through&rdquo;</em> signals — discipline, habit, and consistency —
              into one headline number.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SCORE_KEYS.map((key) => (
          <ScoreCard key={key} scoreKey={key} data={d} />
        ))}
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
          <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">Personal Workload Index</div>
          <div className="mt-2 text-3xl font-bold">{d.personalWorkloadIndex}</div>
          <div className="text-xs text-[var(--text-tertiary)]">tasks/day</div>
          <div className={cn("mt-1 rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-medium", badge.className)}>
            {badge.label}
          </div>
        </div>
      </div>

      {d.efficiencyScore !== null && (
        <p className="text-xs text-[var(--text-tertiary)]">
          Efficiency based on {d.inputs.durationTaskCount} task{d.inputs.durationTaskCount === 1 ? "" : "s"} with duration data.
        </p>
      )}
    </div>
  );
}

// ─── Section 15.5: Streaks ────────────────────────────────────────────────────

function StreaksSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("streaks", { range, categories });
  const d = data as StreaksData | undefined;
  const [threshold, setThreshold] = useState(70);

  const productivePeriod = useMemo(() => {
    if (!d) return { length: 0, start: "", end: "" };
    let best = { length: 0, start: "", end: "" };
    let current = { length: 0, start: "" };
    for (const day of d.timeline) {
      if (day.assigned === 0) continue;
      if (day.completionRate >= threshold) {
        current.length += 1;
        if (!current.start) current.start = day.date;
        if (current.length > best.length) best = { ...current, end: day.date };
      } else {
        current = { length: 0, start: "" };
      }
    }
    return best;
  }, [d, threshold]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height="h-24" />)}
        </div>
        <SkeletonBlock height="h-32" />
        <SkeletonBlock height="h-64" />
      </div>
    );
  }

  if (!d) {
    return <EmptyState title="No data" description="No streak data for this range." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Current Streak" value={`${d.currentStreak} days`} sub="days with ≥1 completion, ending today or yesterday" />
        <StatTile label="Longest Streak" value={`${d.longestStreak.length} days`} sub={d.longestStreak.endDate ? `ended ${d.longestStreak.endDate}` : undefined} />
        <StatTile label="Average Streak" value={fmt(d.averageStreakLength, "d")} sub="per completed streak" />
        <StatTile label="Median Streak" value={fmt(d.medianStreakLength, "d")} sub="per completed streak" />
      </div>

      {d.streakSegments.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Streak Timeline</p>
          <div className="flex h-[320px] items-start gap-1 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
            {d.streakSegments.map((segment, index) => {
              const prevEnd = index > 0 ? d.streakSegments[index - 1].end : null;
              const gapDays = prevEnd ? Math.max(0, parseInt(segment.start, 10) - parseInt(prevEnd, 10) - 1) : 0;
              return (
                <div key={segment.start} className="flex items-end gap-1">
                  {gapDays > 0 && (
                    <span className="mb-0.5 mr-1 h-8 w-[3px] rounded-full bg-[var(--danger)]" title={`${gapDays} day${gapDays === 1 ? "" : "s"} gap`} />
                  )}
                  <div className="group relative">
                    <div
                      className="h-8 rounded-sm bg-[var(--accent)]"
                      style={{ width: Math.max(6, segment.length * 12), minWidth: 6 }}
                    />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-3)] px-2 py-1 text-xs text-[var(--text-secondary)] shadow-lg group-hover:block">
                      {segment.start} → {segment.end} · {segment.length} day{segment.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState title="No streaks" description="No completed-task streaks in this range." />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <ChartWrap title="Streak Length Distribution">
            <BarChart data={d.streakDistribution} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="bucket" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Streaks"]} />
              <Bar dataKey="count" fill="var(--info)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrap>
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Broken Streak Analysis</p>
          {d.brokenStreaks.length === 0 ? (
            <EmptyState title="No broken streaks" description="No streak was broken in this range." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                    <th className="pb-3 text-left font-medium">Broke On</th>
                    <th className="pb-3 text-right font-medium">Streak Length</th>
                    <th className="pb-3 text-right font-medium">Days to Next</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {d.brokenStreaks.map((breakEvent) => (
                    <tr key={breakEvent.brokeOn}>
                      <td className="py-3 text-[var(--text-primary)]">{breakEvent.brokeOn}</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{breakEvent.length} days</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">
                        {Math.max(0, breakEvent.daysToNext - 1)} {Math.max(0, breakEvent.daysToNext - 1) === 1 ? "day" : "days"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">Longest Productive Period</div>
            <div className="mt-1 text-3xl font-bold">{productivePeriod.length} days</div>
            <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
              {productivePeriod.start ? `${productivePeriod.start} → ${productivePeriod.end}` : "none in range"}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
            <span>Completion threshold: {threshold}%</span>
            <input
              type="range"
              min={60}
              max={100}
              step={5}
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              className="w-48 accent-[var(--accent)]"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">
          Days with 0 tasks assigned are neutral. Requires sustained completion above the threshold — distinct from a streak.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Perfect Days" value={d.perfectDays} sub={<ExpandableList title="View list" items={d.perfectDayDates} />} />
        <StatTile
          label="Perfect Weeks"
          value={d.perfectWeeks.length}
          sub={<ExpandableList title="View list" items={d.perfectWeeks.map((week) => `${week.start} → ${week.end}`)} />}
        />
        <StatTile label="Perfect Months" value={d.perfectMonths.length} sub={<ExpandableList title="View list" items={d.perfectMonths} />} />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Category Streaks</p>
        {d.categoryStreaks.length === 0 ? (
          <EmptyState title="No categories" description="No categories in this range." />
        ) : (
          <ul className="space-y-2">
            {d.categoryStreaks.map((category) => (
              <li
                key={category.categoryId}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
                  {category.categoryName}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  current <span className="font-semibold text-[var(--text-primary)]">{category.current}d</span>
                  {" · "}longest <span className="font-semibold text-[var(--text-primary)]">{category.longest}d</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Section 15.6: Category Deep-Dive ─────────────────────────────────────────

function CategoriesSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("categories", { range, categories });
  const d = data as CategoryDeepDiveData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <SkeletonBlock key={i} height="h-28" />)}
        </div>
        <SkeletonBlock height="h-80" />
      </div>
    );
  }

  if (!d || d.ranking.length === 0) {
    return <EmptyState title="No data" description="No category data for this range." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {d.best ? (
          <div className="rounded-[var(--radius-md)] border border-emerald-500/30 bg-[var(--bg-surface-2)] p-4">
            <div className="text-xs uppercase tracking-[0.06em] text-emerald-400">Best Performing</div>
            <div className="mt-1 flex items-center gap-2 text-xl font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: d.best.color }} />
              {d.best.categoryName}
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">{d.best.completionRate}% completion</div>
          </div>
        ) : null}
        {d.worst ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--bg-surface-2)] p-4">
            <div className="text-xs uppercase tracking-[0.06em] text-[var(--danger)]">Worst Performing</div>
            <div className="mt-1 flex items-center gap-2 text-xl font-bold">
              <span className="h-3 w-3 rounded-full" style={{ background: d.worst.color }} />
              {d.worst.categoryName}
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">{d.worst.completionRate}% completion</div>
          </div>
        ) : null}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
          <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">Category Balance</div>
          <div className="mt-1 text-3xl font-bold">{d.balance === null ? "—" : Math.round(d.balance)}</div>
          <div className="mt-1 text-xs text-[var(--text-tertiary)]">
            How evenly effort is distributed across categories (100 = perfectly even)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  <th className="pb-3 text-left font-medium">Category</th>
                  <th className="pb-3 text-right font-medium">Assigned</th>
                  <th className="pb-3 text-right font-medium">Completed</th>
                  <th className="pb-3 text-right font-medium">Rate</th>
                  <th className="pb-3 text-right font-medium">Trend</th>
                  <th className="pb-3 text-right font-medium">Consistency</th>
                  <th className="pb-3 text-right font-medium">Momentum</th>
                  <th className="pb-3 text-right font-medium">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {d.ranking.map((row) => (
                  <tr key={row.categoryId} className="group">
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                        <span className="text-[var(--text-primary)]">{row.categoryName}</span>
                      </span>
                    </td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">{row.assigned}</td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">{row.completed}</td>
                    <td className="py-3 text-right font-medium text-[var(--text-primary)]">{row.completionRate}%</td>
                    <td className={cn("py-3 text-right", deltaColor(row.trend))}>
                      {deltaArrow(row.trend)} {deltaPrefix(row.trend)}{row.trend}
                    </td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">{row.consistency}</td>
                    <td className={cn("py-3 text-right", deltaColor(row.momentum - 50))}>
                      {row.momentum >= 50 ? "↑" : row.momentum < 50 ? "↓" : "→"} {row.momentum}
                    </td>
                    <td className="py-3 text-right text-[var(--text-secondary)]">
                      {row.currentStreak}d / {row.longestStreak}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Best/worst callouts exclude categories with fewer than 5 tasks to avoid tiny-sample distortion.
          </p>
        </div>

        {d.saturation.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Category Saturation</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d.saturation}
                    dataKey="pct"
                    nameKey="categoryName"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {d.saturation.map((entry) => (
                      <Cell key={entry.categoryId} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Saturation"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section 15.7: Time Comparisons ───────────────────────────────────────────

const COMPARISON_PERIODS: Array<{ key: keyof TimeComparisonsData; label: string }> = [
  { key: "weekly", label: "Week over Week" },
  { key: "monthly", label: "Month over Month" },
  { key: "quarterly", label: "Quarter over Quarter" },
  { key: "yearly", label: "Year over Year" },
];

function TimeComparisonsSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("time-comparisons", { range, categories });
  const d = data as TimeComparisonsData | undefined;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height="h-40" />)}
      </div>
    );
  }

  if (!d) return <EmptyState title="No data" description="No comparison data for this range." />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COMPARISON_PERIODS.map((period) => {
        const comparison = d[period.key];
        const rows = [
          { label: "Completion Rate", current: comparison.current.rate, prev: comparison.previous.rate, delta: comparison.delta.rate, suffix: "%" },
          { label: "Tasks Completed", current: comparison.current.completed, prev: comparison.previous.completed, delta: comparison.delta.completed, suffix: "" },
          { label: "Tasks Assigned", current: comparison.current.assigned, prev: comparison.previous.assigned, delta: comparison.delta.assigned, suffix: "" },
        ];
        return (
          <div key={period.key} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4">
            <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">{period.label}</div>
            <div className="mt-3 space-y-3">
              {rows.map((row) => (
                <div key={row.label}>
                  <div className="text-[11px] text-[var(--text-tertiary)]">{row.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold">{row.current}{row.suffix}</span>
                    <span className={cn("text-xs font-medium", deltaColor(row.delta))}>
                      {deltaArrow(row.delta)} {deltaPrefix(row.delta)}{row.delta}{row.suffix}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">prev: {row.prev}{row.suffix}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section 15.8: Distribution & Volume ──────────────────────────────────────

function DistributionSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("distribution", { range, categories });
  const categoriesQuery = useCategoriesQuery(true);
  const d = data as DistributionData | undefined;

  const stacked = useMemo(() => {
    if (!d || d.completionDistribution.length === 0) return null;
    const activeCats = (categoriesQuery.data ?? []).filter((category) =>
      d.completionDistribution.some((row) => Number(row[category.id] ?? 0) > 0),
    );
    const rows = d.completionDistribution.map((row) => {
      const total = Object.entries(row)
        .filter(([key]) => key !== "date")
        .reduce((sum, [, value]) => sum + Number(value ?? 0), 0);
      const out: Record<string, number | string> = { date: row.date as string };
      for (const category of activeCats) {
        out[category.id] = total === 0 ? 0 : Math.round(((Number(row[category.id]) ?? 0) / total) * 1000) / 10;
      }
      return out;
    });
    return { rows, activeCats };
  }, [d, categoriesQuery.data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonBlock key={i} height="h-24" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonBlock height="h-[280px]" />
          <SkeletonBlock height="h-[280px]" />
        </div>
      </div>
    );
  }

  if (!d) return <EmptyState title="No data" description="No distribution data for this range." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Avg Daily Assigned" value={d.averages.assigned} />
        <StatTile label="Avg Daily Completed" value={d.averages.completed} />
        <StatTile label="Pending (Actionable Backlog)" value={d.pendingCount} sub="incomplete, due ≤ today" />
        <StatTile
          label="Completion Velocity"
          value={d.velocity === null ? "—" : `${deltaPrefix(d.velocity)}${d.velocity}%`}
          sub={d.velocity === null ? "not enough data" : "last 7 days vs prior 7 days"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrap title="Task Frequency Distribution">
          <BarChart data={d.taskFrequency} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Days"]} />
            <Bar dataKey="count" fill="var(--info)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrap>
        <ChartWrap title="Daily Completion Distribution">
          <BarChart data={d.completionHistogram} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="bucket" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Days"]} />
            <Bar dataKey="count" fill="var(--warning)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrap>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrap title="Task Volume Trend (per week)">
          <LineChart data={d.volumeTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Assigned"]} />
            <Line type="monotone" dataKey="assigned" stroke="var(--accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartWrap>
        <ChartWrap title="Task Backlog Trend (end of day)">
          <AreaChart data={d.backlogTrend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Pending"]} />
            <Area type="monotone" dataKey="count" stroke="var(--danger)" fill="var(--danger)" fillOpacity={0.12} dot={false} />
          </AreaChart>
        </ChartWrap>
      </div>

      {stacked && stacked.rows.length > 0 && stacked.activeCats.length > 0 && (
        <ChartWrap title="Completion Distribution by Category (100% stacked)">
          <AreaChart data={stacked.rows} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} stackOffset="expand">
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={tickLabel} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {stacked.activeCats.map((category) => (
              <Area
                key={category.id}
                type="monotone"
                dataKey={category.id}
                name={category.name}
                stackId="1"
                stroke={category.color}
                fill={category.color}
                fillOpacity={0.55}
                dot={false}
              />
            ))}
          </AreaChart>
        </ChartWrap>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Task Density (per category per week)</p>
        {d.taskDensity.length === 0 ? (
          <EmptyState title="No categories" description="No category data for this range." />
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {d.taskDensity.map((category) => (
              <li
                key={category.categoryId}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: category.color }} />
                  {category.categoryName}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{category.perWeek}</span> tasks/week
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Section 15.9: Aging & Overdue ────────────────────────────────────────────

function AgingSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("aging", { range, categories });
  const d = data as AgingData | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock height="h-72" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonBlock height="h-[280px]" />
          <SkeletonBlock height="h-[280px]" />
        </div>
      </div>
    );
  }

  if (!d) return <EmptyState title="No data" description="No aging data for this range." />;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-secondary)]">Overdue Analysis</p>
        {d.overdue.length === 0 ? (
          <EmptyState title="No overdue tasks" description="All tasks are on track for this range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                  <th className="pb-3 text-left font-medium">Task</th>
                  <th className="pb-3 text-left font-medium">Category</th>
                  <th className="pb-3 text-right font-medium">Days Overdue</th>
                  <th className="pb-3 text-right font-medium">Priority</th>
                  <th className="pb-3 text-right font-medium">Completion Probability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {d.overdue.map((task) => {
                  const probability = PROBABILITY_META[task.probability];
                  return (
                    <tr key={task.id}>
                      <td className="py-3 text-[var(--text-primary)]">{task.title}</td>
                      <td className="py-3 text-[var(--text-secondary)]">{task.category}</td>
                      <td className="py-3 text-right font-medium text-[var(--danger)]">{task.daysOverdue}</td>
                      <td className={cn("py-3 text-right capitalize", PRIORITY_COLOR[task.priority?.toUpperCase() ?? ""] ?? "text-[var(--text-secondary)]")}>
                        {task.priority ?? "—"}
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-medium", probability.className)}
                          title="A rough heuristic based on this category's historical completion rate, not a prediction"
                        >
                          {probability.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrap title="Task Aging (incomplete by age)">
          <BarChart data={d.aging} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="bucket" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Tasks"]} />
            <Bar dataKey="count" fill="var(--warning)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrap>
        <div>
          <ChartWrap title={`Completion Lag (avg ${fmt(d.completionLag.average, "d")} days)`}>
            <BarChart data={d.completionLag.histogram} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="bucket" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [String(v), "Tasks"]} />
              <Bar dataKey="count" fill="var(--info)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartWrap>
        </div>
      </div>
    </div>
  );
}

// ─── Section 15.10: Priority & Duration ───────────────────────────────────────

function PriorityDurationSection({ range, categories }: SectionProps) {
  const { data, isLoading } = useAnalyticsSection("priority-duration", { range, categories });
  const d = data as PriorityDurationData | undefined;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBlock height="h-[280px]" />
        <SkeletonBlock height="h-[280px]" />
      </div>
    );
  }

  if (!d) return <EmptyState title="No data" description="No priority/duration data for this range." />;

  const unlocked = d.usage.priorityTasks + d.usage.durationTasks >= 5;

  if (!unlocked) {
    return (
      <EmptyState
        title="Not enough data"
        description="Start setting priority/duration on tasks to unlock this section."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrap title="Completion Rate by Priority">
          <BarChart data={d.byPriority} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="priority" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name, item) => {
                const payload = item?.payload as { total?: number } | undefined;
                return [`${v}% (${payload?.total ?? "?"} tasks)`, "Completion Rate"];
              }}
            />
            <Bar dataKey="completionRate" radius={[4, 4, 0, 0]}>
              {d.byPriority.map((entry) => (
                <Cell key={entry.priority} fill={PRIORITY_COLOR[entry.priority] ?? "var(--accent)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartWrap>

        <ChartWrap title="Task Duration Analytics (minutes)">
          <BarChart data={d.duration.byCategory} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="categoryName" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="estimated" name="Estimated" fill="var(--info)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name="Actual" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartWrap>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Efficiency Score"
          value={d.efficiencyScore === null ? "—" : Math.round(d.efficiencyScore)}
          sub={d.efficiencyScore === null ? "no tasks with both durations" : `based on ${d.usage.durationTasks} tasks with duration data`}
        />
        <StatTile label="Avg Estimated" value={`${fmt(d.duration.overall.estimated, "")} min`} />
        <StatTile label="Avg Actual" value={`${fmt(d.duration.overall.actual, "")} min`} />
      </div>

      {d.peakHours !== null && (
        <ChartWrap title="Peak Productivity Hours">
          <BarChart data={d.peakHours} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis dataKey="hour" stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}:00`} />
            <YAxis stroke="var(--text-tertiary)" tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _name, item) => {
              const payload = item?.payload as { hour?: number } | undefined;
              return [String(v), `Completions (${payload?.hour ?? 0}:00)`];
            }} />
            <Bar dataKey="count" fill="var(--accent)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartWrap>
      )}
    </div>
  );
}

// ─── Shared props ─────────────────────────────────────────────────────────────

interface SectionProps {
  range: Range;
  categories: string[];
}

// ─── Root Page ────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [range, setRange] = useState<Range>(() => {
    if (typeof window === "undefined") return "30d";
    const value = new URLSearchParams(window.location.search).get("range");
    return RANGES.some((option) => option.value === value) ? (value as Range) : "30d";
  });
  const [selected, setSelected] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    return (new URLSearchParams(window.location.search).get("cat") ?? "").split(",").filter(Boolean);
  });
  const { collapsedMap, toggle } = useCollapsedSections();
  const categoriesQuery = useCategoriesQuery(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (range !== "30d") params.set("range", range);
    if (selected.length > 0) params.set("cat", selected.join(","));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/analytics?${query}` : "/analytics");
  }, [range, selected]);

  const toggleCategory = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const categoryOptions = categoriesQuery.data ?? [];

  return (
    <div className="space-y-8">
      <Card>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Metrics-first surface for completion, consistency, and category behaviour.
        </p>
      </Card>

      <div className="sticky top-[73px] z-10 space-y-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[rgba(10,10,11,0.92)] px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition",
                range === value
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-3)] hover:text-[var(--text-primary)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-[var(--text-tertiary)]">Categories:</span>
          <button
            type="button"
            onClick={() => setSelected([])}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition",
              selected.length === 0
                ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            All
          </button>
          {categoryOptions.map((category) => {
            const active = selected.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                {category.name}
                {active && <X className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <SectionShell id="completion-rates" title="Completion Rates" collapsedMap={collapsedMap} onToggle={toggle}>
        <CompletionRatesSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="assigned-vs-completed" title="Assigned vs. Completed" collapsedMap={collapsedMap} onToggle={toggle}>
        <AssignedVsCompletedSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="missed-tasks" title="Incomplete & Missed Tasks" collapsedMap={collapsedMap} onToggle={toggle}>
        <MissedTasksSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="trends" title="Trends" collapsedMap={collapsedMap} onToggle={toggle}>
        <TrendsSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="scores" title="Scores" collapsedMap={collapsedMap} onToggle={toggle}>
        <ScoresSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="streaks" title="Streaks" collapsedMap={collapsedMap} onToggle={toggle}>
        <StreaksSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="categories" title="Category Deep-Dive" collapsedMap={collapsedMap} onToggle={toggle}>
        <CategoriesSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="time-comparisons" title="Time Comparisons" collapsedMap={collapsedMap} onToggle={toggle}>
        <TimeComparisonsSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="distribution" title="Distribution & Volume" collapsedMap={collapsedMap} onToggle={toggle}>
        <DistributionSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell id="aging" title="Aging & Overdue Analysis" collapsedMap={collapsedMap} onToggle={toggle}>
        <AgingSection range={range} categories={selected} />
      </SectionShell>

      <SectionShell
        id="priority-duration"
        title="Priority & Duration Analytics"
        collapsedMap={collapsedMap}
        onToggle={toggle}
        defaultCollapsed
        note="Not enough data — start setting priority/duration on tasks to unlock this section."
      >
        <PriorityDurationSection range={range} categories={selected} />
      </SectionShell>
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendPoint = { date: string; completionRate: number };
type WeekdayPoint = { weekday: string; completionRate: number };

// ─── Shared tooltip style ──────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  background: "var(--bg-surface-2)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  fontSize: 12,
} as const;

// ─── 90-day completion trend ───────────────────────────────────────────────────

export function CategoryTrendChart({
  trend,
  color,
}: {
  trend: TrendPoint[];
  color: string;
}) {
  return (
    <div className="h-64">
      {trend.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
          No completion data for the last 90 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="categoryTrendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
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
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`${v ?? 0}%`, "Completion"]}
            />
            <Area
              type="monotone"
              dataKey="completionRate"
              stroke={color}
              fill="url(#categoryTrendFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Completion by weekday ─────────────────────────────────────────────────────

export function CategoryWeekdayChart({
  weekday,
  color,
}: {
  weekday: WeekdayPoint[];
  color: string;
}) {
  return (
    <div className="h-56">
      {weekday.length === 0 ||
      weekday.every((day) => day.completionRate === 0) ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-tertiary)]">
          No weekday data for the last 90 days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekday}>
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="weekday"
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: string) => v.slice(0, 3)}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              tick={{ fontSize: 10 }}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [`${v ?? 0}%`, "Completion"]}
            />
            <Bar dataKey="completionRate" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

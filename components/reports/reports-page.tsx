"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/hooks/use-api";
import { generateReportPdf } from "@/lib/report-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportCategory = {
  categoryId: string;
  categoryName: string;
  color: string;
  assigned: number;
  completed: number;
  completionRate: number;
};

type NotableDay = { date: string; assigned: number; completed: number; completionRate: number };

type ReportData = {
  summary: {
    totals: { assigned: number; completed: number };
    overallCompletionRate: number;
    currentStreak: number;
  };
  scores: { productivityScore: number };
  trend: Array<{ date: string; completionRate: number }>;
  categories: ReportCategory[];
  notableDays: { best: NotableDay[]; missed: NotableDay[] };
  from: string;
  to: string;
  generatedAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGES: Array<{ value: string; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-year", label: "This Year" },
];

function rangeLabel(range: string, from: string, to: string) {
  if (range === "custom") {
    return `${new Date(from).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} – ${new Date(to).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return RANGES.find((r) => r.value === range)?.label ?? range;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const [range, setRange] = useState("30d");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const report = useQuery<ReportData>({
    queryKey: ["report", range, customFrom, customTo],
    queryFn: () =>
      fetchJson<ReportData>(
        range === "custom"
          ? `/api/reports?range=custom&from=${customFrom}&to=${customTo}`
          : `/api/reports?range=${range}`,
      ),
    enabled: range !== "custom" || (!!customFrom && !!customTo),
  });

  const d = report.data;

  const sortedCategories = d
    ? [...d.categories].sort((a, b) => b.completionRate - a.completionRate)
    : [];

  const customValid = !!customFrom && !!customTo && customFrom <= customTo;

  function handleCustomApply() {
    if (!customValid) return;
    setRange("custom");
    setCustomOpen(false);
  }

  function handlePdf() {
    if (!d) return;
    generateReportPdf(
      {
        title: `Report: ${rangeLabel(range, d.from, d.to)}`,
        rangeLabel: rangeLabel(range, d.from, d.to),
        summary: d.summary,
        scores: d.scores,
        trend: d.trend,
        categories: sortedCategories,
        notableDays: d.notableDays,
      },
      range,
    );
  }

  const csvHref =
    range === "custom"
      ? `/api/reports/export/csv?range=custom&from=${customFrom}&to=${customTo}`
      : `/api/reports/export/csv?range=${range}`;

  return (
    <div className="space-y-6">
      {/* ── Header + range picker ── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Reports</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Generate printable summaries and export raw data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map(({ value, label }) => (
              <Button
                key={value}
                variant={range === value ? "primary" : "secondary"}
                onClick={() => setRange(value)}
                className="text-xs"
              >
                {label}
              </Button>
            ))}
            <Button
              variant={range === "custom" ? "primary" : "secondary"}
              onClick={() => setCustomOpen((prev) => !prev)}
              className="gap-1.5 text-xs"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Custom
            </Button>
            <Button variant="ghost" className="gap-1.5 text-xs" onClick={handlePdf} disabled={!d}>
              <FileText className="h-3.5 w-3.5" />
              Export PDF
            </Button>
            <a href={csvHref}>
              <Button variant="ghost" className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </a>
          </div>
        </div>

        {/* Custom range picker */}
        {customOpen && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
                From
              </label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
                To
              </label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleCustomApply}
              disabled={!customValid}
              className="text-xs"
            >
              Apply
            </Button>
          </div>
        )}
      </Card>

      {report.isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-64" />
        </div>
      ) : d ? (
        <>
          {/* ── Report header ── */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Report: {rangeLabel(range, d.from, d.to)}
            </h2>
            <p className="text-xs text-[var(--text-tertiary)]">
              {new Date(d.generatedAt).toLocaleString()} ·{" "}
              {new Date(d.from).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              –{" "}
              {new Date(d.to).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {/* ── Summary cards ── */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Summary</h2>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { label: "Assigned", value: `${d.summary.totals.assigned ?? 0}` },
                { label: "Completed", value: `${d.summary.totals.completed ?? 0}` },
                { label: "Completion", value: `${d.summary.overallCompletionRate ?? 0}%` },
                {
                  label: "Current streak",
                  value: `${d.summary.currentStreak ?? 0} day${d.summary.currentStreak === 1 ? "" : "s"}`,
                },
                { label: "Productivity", value: `${Math.round(d.scores.productivityScore ?? 0)}` },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-4"
                >
                  <div className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                    {card.label}
                  </div>
                  <div className="mt-2 text-3xl font-bold">{card.value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Completion trend chart ── */}
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Completion Trend</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Daily completion percentage for the selected range.
              </p>
            </div>
            {d.trend.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-[var(--text-tertiary)]">
                No trend data for this range.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.trend}>
                    <defs>
                      <linearGradient id="reportTrendFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4ade80" stopOpacity={0.4} />
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
                      fill="url(#reportTrendFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ── Category breakdown ── */}
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Category Breakdown</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Completion performance per category, sorted by rate.
              </p>
            </div>

            {sortedCategories.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                No category data available for this range.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="pb-3 pr-4 text-left text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Category
                      </th>
                      <th className="pb-3 pr-4 text-right text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Assigned
                      </th>
                      <th className="pb-3 pr-4 text-right text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Completed
                      </th>
                      <th className="pb-3 text-right text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                        Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {sortedCategories.map((cat) => (
                      <tr key={cat.categoryId}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="font-medium">{cat.categoryName}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {cat.assigned}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-[var(--text-secondary)]">
                          {cat.completed}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-surface-3)]">
                              <div
                                className="h-1.5 rounded-full bg-[var(--accent)]"
                                style={{
                                  width: `${Math.max(cat.completionRate, cat.assigned > 0 ? 2 : 0)}%`,
                                }}
                              />
                            </div>
                            <span
                              className={`w-10 text-right tabular-nums font-medium ${
                                cat.completionRate >= 75
                                  ? "text-[var(--accent)]"
                                  : cat.completionRate >= 40
                                    ? "text-[var(--warning)]"
                                    : "text-[var(--danger)]"
                              }`}
                            >
                              {cat.completionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Notable days ── */}
          <Card>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Notable Days</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Best days by completion score, plus days you missed entirely.
              </p>
            </div>
            {d.notableDays.best.length === 0 && d.notableDays.missed.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                No scheduled days in this range.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {d.notableDays.best.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-black">
                      {day.completionRate}%
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {day.completed}/{day.assigned} completed
                      </p>
                    </div>
                  </div>
                ))}
                {d.notableDays.missed.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-surface-2)] p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--danger)] text-sm font-bold text-white">
                      {day.completionRate}%
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Missed · {day.assigned} task{day.assigned === 1 ? "" : "s"} not done
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Footer ── */}
          <p className="text-center text-xs text-[var(--text-tertiary)]">
            Generated by Self Tasks Tracking Dashboard on{" "}
            {new Date(d.generatedAt).toLocaleString()}.
          </p>
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-[var(--text-tertiary)]">
          Could not load the report.
        </Card>
      )}
    </div>
  );
}

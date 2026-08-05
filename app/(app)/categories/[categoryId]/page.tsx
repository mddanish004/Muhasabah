import Link from "next/link";
import { notFound } from "next/navigation";
import * as LucideIcons from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Flame,
  Gauge,
  ListTodo,
  Percent,
  TrendingUp,
} from "lucide-react";
import { subDays } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CategoryTrendChart,
  CategoryWeekdayChart,
} from "@/components/categories/category-charts";
import { requireSession, getAdminConfig } from "@/lib/auth";
import { getCategoryById, getTasks } from "@/lib/data";
import { buildCompletionRates, buildScores, buildStreaks } from "@/lib/analytics/core";
import { toEndOfLocalDay, toStartOfLocalDay } from "@/lib/date";
import type { TaskWithRelations } from "@/lib/types";

// ─── Dynamic icon helper ──────────────────────────────────────────────────────

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const key = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const IconComp =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[key] ??
    LucideIcons.FolderKanban;
  return <IconComp className={className} />;
}

// ─── Priority badge colours ───────────────────────────────────────────────────

function priorityStyle(priority: string | null): string {
  switch (priority) {
    case "HIGH":
      return "border-[var(--danger)] text-[var(--danger)]";
    case "MEDIUM":
      return "border-[var(--warning)] text-[var(--warning)]";
    case "LOW":
      return "border-[var(--info)] text-[var(--info)]";
    default:
      return "border-[var(--border-default)] text-[var(--text-tertiary)]";
  }
}

function priorityLabel(priority: string | null): string {
  if (!priority) return "None";
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: TaskWithRelations }) {
  const done = Boolean(task.completedAt);
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-3">
      <span className="mt-0.5 shrink-0 text-[var(--text-tertiary)]">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={[
            "text-sm leading-snug",
            done ? "text-[var(--text-tertiary)] line-through" : "text-[var(--text-primary)]",
          ].join(" ")}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.priority && (
            <span
              className={[
                "inline-flex items-center rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
                priorityStyle(task.priority),
              ].join(" ")}
            >
              {priorityLabel(task.priority)}
            </span>
          )}
          {task.dueDate && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {done && task.completedAt && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              Completed {new Date(task.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--text-tertiary)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryDetailRoute({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  await requireSession();

  const { categoryId } = await params;
  const category = await getCategoryById(categoryId);
  if (!category) notFound();

  const [admin, tasks] = await Promise.all([
    getAdminConfig(),
    getTasks({ categoryIds: [categoryId] }),
  ]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completedAt !== null).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── 90-day mini analytics scoped to this category ──
  const from = toStartOfLocalDay(subDays(new Date(), 89), admin.timezone);
  const to = toEndOfLocalDay(new Date(), admin.timezone);
  const scopedTasks = await getTasks({ categoryIds: [categoryId], from, to });
  const completionRates = buildCompletionRates(scopedTasks, [category], from, to, admin.timezone);
  const streaks = buildStreaks(scopedTasks, [category], from, to, admin.timezone, admin.weekStartsOn);
  const scores = buildScores(scopedTasks, [category], from, to, admin.timezone);

  const incomplete = tasks.filter((t) => !t.completedAt);
  const completed = tasks.filter((t) => t.completedAt);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All Categories
      </Link>

      {/* Category header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
              style={{ backgroundColor: category.color + "26" }}
            >
              <CategoryIcon
                name={category.icon}
                className="h-6 w-6"
              />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold" style={{ color: category.color }}>
                  {category.name}
                </h1>
                {category.isArchived && (
                  <Badge>Archived</Badge>
                )}
              </div>
              {category.description && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {category.description}
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Created {new Date(category.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          <Link href={`/categories?edit=${category.id}`}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-surface-3)]"
            >
              Edit
            </button>
          </Link>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total tasks"
          value={totalTasks}
          icon={ListTodo}
          color="var(--text-primary)"
        />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          icon={Percent}
          color="var(--accent)"
        />
        <StatCard
          label="Current streak"
          value={`${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`}
          icon={Flame}
          color="var(--warning)"
        />
        <StatCard
          label="Longest streak"
          value={`${streaks.longestStreak.length} day${streaks.longestStreak.length === 1 ? "" : "s"}`}
          icon={TrendingUp}
          color="var(--info)"
        />
        <StatCard
          label="Consistency"
          value={`${Math.round(scores.consistencyScore)}/100`}
          icon={Gauge}
          color="var(--text-primary)"
        />
      </div>

      {/* Mini analytics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Completion Trend</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Daily completion percentage for this category, last 90 days.
            </p>
          </div>
          <CategoryTrendChart trend={completionRates.daily} color={category.color} />
        </Card>
        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">By Weekday</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Average completion rate per day of the week.
            </p>
          </div>
          <CategoryWeekdayChart weekday={completionRates.byWeekday} color={category.color} />
        </Card>
      </div>

      {/* Task list */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Tasks</h2>

        {tasks.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">
            No tasks in this category yet.
          </p>
        )}

        {incomplete.length > 0 && (
          <div className="space-y-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
              Incomplete ({incomplete.length})
            </p>
            {incomplete.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}

        {incomplete.length > 0 && completed.length > 0 && (
          <hr className="my-5 border-[var(--border-subtle)]" />
        )}

        {completed.length > 0 && (
          <div className="space-y-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
              Completed ({completed.length})
            </p>
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

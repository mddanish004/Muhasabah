"use client";

import { useEffect } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarDayQuery } from "@/hooks/useCalendarDayQuery";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { useToggleTaskMutation } from "@/hooks/useTaskMutations";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useUiStore } from "@/stores/uiStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type DayTask = {
  id: string;
  title: string;
  completedAt: string | null;
  dueDate: string | null;
  priority: Priority | null;
  createdAt: string;
  category: { id: string; name: string; color: string };
};

type DayCategories = Record<string, { assigned: number; completed: number }>;

type CalendarDayData = {
  summary: {
    date: string;
    assigned: number;
    completed: number;
    completionRate: number;
    categories: DayCategories;
  };
  streaks: {
    currentStreak: number;
    brokenStreaks: Array<{ brokeOn: string; length: number }>;
    streakSegments: Array<{ start: string; end: string; length: number }>;
  };
  tasks: DayTask[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "text-[var(--text-tertiary)] border-[var(--border-default)]",
  MEDIUM: "text-[var(--info)] border-[var(--info)]",
  HIGH: "text-[var(--warning)] border-[var(--warning)]",
  URGENT: "text-[var(--danger)] border-[var(--danger)]",
};

function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scoreColor(score: number): string {
  if (score < 40) return "bg-[var(--danger)] text-white";
  if (score <= 70) return "bg-[var(--warning)] text-black";
  return "bg-[var(--success)] text-black";
}

function dueTimeLabel(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (date.getHours() === 0 && date.getMinutes() === 0) return null;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function streakBanner(data: CalendarDayData, date: string, isFuture: boolean): string {
  if (isFuture) return "";
  const { streaks } = data;
  if (date === new Date().toISOString().slice(0, 10) && streaks.currentStreak > 0) {
    return `Day ${streaks.currentStreak} of current streak`;
  }
  const broken = streaks.brokenStreaks.find((item) => item.brokeOn === date);
  if (broken) return `Streak reset — this day broke a ${broken.length}-day streak`;
  const segment = streaks.streakSegments.find((item) => item.start <= date && date <= item.end);
  if (segment) {
    const dayNumber = Math.min(
      segment.length,
      Math.round(
        (new Date(`${date}T12:00:00`).getTime() - new Date(`${segment.start}T12:00:00`).getTime()) / 86400000,
      ) + 1,
    );
    return `Day ${dayNumber} of a ${segment.length}-day streak (${segment.start} → ${segment.end})`;
  }
  if (data.summary.assigned > 0) return "No streak activity on this day";
  return "No tasks scheduled on this day";
}

// ─── DayDetailContent ─────────────────────────────────────────────────────────

export function DayDetailContent({ date, onAddTask }: { date: string; onAddTask: () => void }) {
  const dayQuery = useCalendarDayQuery(date);
  const categoriesQuery = useCategoriesQuery(true);
  const toggleTask = useToggleTaskMutation();
  const queryClient = useQueryClient();

  const data = dayQuery.data as CalendarDayData | undefined;
  const isFuture = date > new Date().toISOString().slice(0, 10);

  function handleToggleTask(task: DayTask) {
    toggleTask.mutate(
      { id: task.id, completed: !task.completedAt },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["calendar", "day"] });
          void queryClient.invalidateQueries({ queryKey: ["calendar", "month"] });
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      },
    );
  }

  if (dayQuery.isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex justify-center py-4">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
        <Skeleton className="h-10" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-[var(--text-tertiary)]">Could not load this day.</div>
    );
  }

  const summary = data.summary;
  const tasks = data.tasks ?? [];

  const sortedTasks = [...tasks].sort((a, b) => {
    const aDone = !!a.completedAt;
    const bDone = !!b.completedAt;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (!aDone && !bDone) {
      const rankDiff = (PRIORITY_RANK[b.priority ?? ""] ?? -1) - (PRIORITY_RANK[a.priority ?? ""] ?? -1);
      if (rankDiff !== 0) return rankDiff;
      return a.createdAt.localeCompare(b.createdAt);
    }
    return b.completedAt!.localeCompare(a.completedAt!);
  });

  const categoryRows = Object.entries(summary.categories ?? {})
    .map(([categoryId, stats]) => ({
      categoryId,
      ...stats,
      category: (categoriesQuery.data ?? []).find((c) => c.id === categoryId),
    }))
    .filter((row) => row.category && row.assigned > 0)
    .sort((a, b) => b.assigned - a.assigned);
  const totalAssignedInCategories = categoryRows.reduce((sum, row) => sum + row.assigned, 0);

  const score = summary.completionRate;
  const banner = streakBanner(data, date, isFuture);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
        <div>
          <h2 className="text-base font-semibold">{format(new Date(`${date}T12:00:00`), "EEEE, MMMM d, yyyy")}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {summary.assigned} scheduled · {summary.completed} completed
            {isFuture ? " · future date" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/calendar?date=${shiftDateKey(date, -1)}`}
            aria-label="Previous day"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </a>
          <a
            href={`/calendar?date=${shiftDateKey(date, 1)}`}
            aria-label="Next day"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
          >
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!isFuture && (
          <div className="flex items-center gap-5">
            <ProgressRing value={score} label="done" size={96} />
            <div className="space-y-2">
              <span
                className={cn(
                  "inline-block rounded-full px-3 py-1 text-sm font-bold",
                  scoreColor(score),
                )}
              >
                Day Score: {Math.round(score)}
              </span>
              {banner && (
                <p className="text-xs text-[var(--text-secondary)]">{banner}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Category breakdown ── */}
        {categoryRows.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
              Categories
            </p>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--bg-surface-3)]">
              {categoryRows.map((row) => (
                <div
                  key={row.categoryId}
                  title={`${row.category?.name ?? ""}: ${row.completed}/${row.assigned}`}
                  style={{
                    width: `${(row.assigned / totalAssignedInCategories) * 100}%`,
                    background: row.category?.color ?? "var(--accent)",
                  }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5">
              {categoryRows.map((row) => (
                <li key={row.categoryId} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: row.category?.color }} />
                  <span className="flex-1">{row.category?.name}</span>
                  <span>
                    {row.completed}/{row.assigned} completed
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">
            {isFuture ? "No tasks scheduled yet — pre-plan with Quick Add." : "No tasks assigned to this day."}
          </p>
        )}

        {/* ── Task list ── */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            {sortedTasks.map((task) => {
              const isComplete = !!task.completedAt;
              const dueTime = dueTimeLabel(task.dueDate);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3 transition",
                    isComplete ? "opacity-55" : "hover:bg-[var(--bg-surface-2)]",
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isComplete}
                    disabled={toggleTask.isPending}
                    onClick={() => handleToggleTask(task)}
                    className={cn(
                      "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition",
                      isComplete
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border-default)] hover:border-[var(--accent)]",
                    )}
                  >
                    {isComplete && <Check className="h-2.5 w-2.5 text-black" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", isComplete && "line-through")}>{task.title}</div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: task.category.color }}
                        />
                        {task.category.name}
                      </span>
                      {task.priority && (
                        <span
                          className={cn(
                            "rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            PRIORITY_BADGE[task.priority],
                          )}
                        >
                          {task.priority}
                        </span>
                      )}
                      {dueTime && <span className="text-[var(--text-tertiary)]">at {dueTime}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer: add task ── */}
      <div className="border-t border-[var(--border-subtle)] p-4">
        <Button variant="secondary" className="w-full" onClick={onAddTask}>
          + Add task to this day
        </Button>
        {isFuture && (
          <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
            Pre-planning — task will be marked as scheduled for {date}.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── DayPanel (slide-over) ────────────────────────────────────────────────────

export function DayPanel() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const setQuickAdd = useUiStore((s) => s.setQuickAdd);
  const panelRef = useFocusTrap<HTMLDivElement>(activePanel?.type === "day");

  const isOpen = activePanel?.type === "day";
  const date = activePanel?.type === "day" ? activePanel.date : undefined;

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePanel(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setActivePanel]);

  function close() {
    setActivePanel(null);
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Day detail"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-lg)] transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {isOpen && date && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <span className="text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">Day Detail</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close panel"
                className="rounded-[var(--radius-sm)] p-1 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DayDetailContent
              key={date}
              date={date}
              onAddTask={() => {
                close();
                setQuickAdd(true, date, date < new Date().toISOString().slice(0, 10));
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

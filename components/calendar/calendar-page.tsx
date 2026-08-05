"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus } from "lucide-react";
import { addDays, format, getDay, getDaysInMonth, startOfMonth, startOfWeek } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DayDetailContent } from "@/components/calendar/day-panel";
import { useCalendarDayQuery } from "@/hooks/useCalendarDayQuery";
import { useCalendarMonthQuery } from "@/hooks/useCalendarMonthQuery";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "month" | "week" | "day";

type MonthDay = {
  date: string;
  completionRate: number;
  completed: number;
  assigned: number;
  categories: Record<string, { assigned: number; completed: number }>;
};

type DayTask = {
  id: string;
  title: string;
  completedAt: string | null;
  category: { id: string; name: string; color: string };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateKeyLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDateKey(dateKey: string, amount: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKeyLocal(date);
}

function weekdayLabels(weekStartsOn: number): string[] {
  const base = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...base.slice(weekStartsOn), ...base.slice(0, weekStartsOn)];
}

// ─── Week column ──────────────────────────────────────────────────────────────

function WeekDayColumn({ date, weekStartsOn }: { date: string; weekStartsOn: number }) {
  const dayQuery = useCalendarDayQuery(date);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const tasks = (dayQuery.data as { tasks: DayTask[] } | undefined)?.tasks ?? [];
  const isToday = date === new Date().toISOString().slice(0, 10);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-[var(--radius-md)] border p-2",
        isToday
          ? "border-[var(--accent)] bg-[var(--accent-muted)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface-1)]",
      )}
    >
      <button
        type="button"
        onClick={() => setActivePanel({ type: "day", date })}
        className={cn(
          "mb-2 rounded-[var(--radius-sm)] px-1 py-1 text-center transition hover:bg-[var(--bg-surface-2)]",
          isToday ? "text-[var(--accent)]" : "",
        )}
      >
        <div className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)]">
          {weekdayLabels(weekStartsOn)[((new Date(`${date}T12:00:00`).getDay() - weekStartsOn) % 7 + 7) % 7]}
        </div>
        <div className="text-sm font-semibold">{Number(date.slice(8, 10))}</div>
      </button>

      <div className="max-h-[460px] flex-1 space-y-1 overflow-y-auto">
        {dayQuery.isLoading ? (
          <div className="space-y-1.5 p-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : tasks.length === 0 ? (
          <p className="px-1 py-2 text-center text-xs text-[var(--text-tertiary)]">—</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] px-1.5 py-1",
                task.completedAt && "opacity-55",
              )}
              title={task.title}
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: task.category.color }} />
              <span className={cn("truncate text-xs", task.completedAt && "line-through")}>{task.title}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const setQuickAdd = useUiStore((s) => s.setQuickAdd);
  const activePanel = useUiStore((s) => s.activePanel);
  const commandOpen = useUiStore((s) => s.commandOpen);
  const settingsQuery = useSettingsQuery();
  const weekStartsOn = settingsQuery.data?.weekStartsOn ?? 1;

  const todayStr = new Date().toISOString().slice(0, 10);

  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "month";
    const param = new URLSearchParams(window.location.search).get("view");
    return param === "week" || param === "day" ? param : "month";
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window === "undefined") return todayStr;
    return new URLSearchParams(window.location.search).get("date") ?? todayStr;
  });
  const [cursor, setCursor] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date();
    const date = new URLSearchParams(window.location.search).get("date");
    return date ? new Date(`${date}T12:00:00`) : new Date();
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const monthQuery = useCalendarMonthQuery(year, month);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDate !== todayStr) params.set("date", selectedDate);
    if (view !== "month") params.set("view", view);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/calendar?${query}` : "/calendar");
  }, [view, selectedDate, todayStr]);

  // Keyboard shortcuts: M/W/D views, T today, ←/→ navigate, Esc back to grid
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      // Don't hijack keys while a slide-over panel or the palette is open
      if (activePanel || commandOpen) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        setView("month");
      } else if (key === "w") {
        e.preventDefault();
        setView("week");
      } else if (key === "d") {
        e.preventDefault();
        setView("day");
      } else if (key === "t") {
        e.preventDefault();
        setCursor(new Date());
        setSelectedDate(todayStr);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        if (view === "day") {
          setSelectedDate((prev) => shiftDateKey(prev, direction));
          setCursor((prev) => addDays(prev, direction));
        } else if (view === "week") {
          setCursor((prev) => addDays(prev, direction * 7));
        } else {
          setCursor((prev) => {
            const next = new Date(prev);
            next.setMonth(next.getMonth() + direction);
            return next;
          });
        }
      } else if (e.key === "Escape" && view === "day") {
        setView("month");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, todayStr, activePanel, commandOpen]);

  function goToToday() {
    setCursor(new Date());
    setSelectedDate(todayStr);
  }

  // ── Month grid (42 cells) ──
  const monthStart = startOfMonth(cursor);
  const firstDayOffset = ((getDay(monthStart) - weekStartsOn) % 7 + 7) % 7;
  const daysInMonth = getDaysInMonth(cursor);
  const monthDays = (monthQuery.data as MonthDay[] | undefined) ?? [];
  const dayMap = new Map(monthDays.map((d) => [d.date, d]));
  const categoryColors = new Map(
    (useCategoriesQuery(true).data ?? []).map((category) => [category.id, category.color]),
  );

  const monthCells = Array.from({ length: 42 }, (_, index) => {
    const offset = index - firstDayOffset;
    const date = addDays(monthStart, offset);
    const dateStr = dateKeyLocal(date);
    const inMonth = offset >= 0 && offset < daysInMonth;
    const data = dayMap.get(dateStr) ?? {
      date: dateStr,
      completionRate: 0,
      completed: 0,
      assigned: 0,
      categories: {},
    };
    return { date: dateStr, inMonth, dayNum: date.getDate(), data };
  });

  // ── Week days ──
  const weekStart = startOfWeek(cursor, { weekStartsOn: weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const weekDates = Array.from({ length: 7 }, (_, i) => dateKeyLocal(addDays(weekStart, i)));

  const headerLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
        : format(new Date(`${selectedDate}T12:00:00`), "EEEE, MMMM d, yyyy");

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Calendar</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Browse any day and inspect planned vs completed work.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)]">
              {(["month", "week", "day"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setView(mode)}
                  className={cn(
                    "px-3 py-1.5 text-sm capitalize transition",
                    view === mode
                      ? "bg-[var(--accent)] text-black"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={goToToday} className="text-xs">
              Today
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                const direction = -1;
                if (view === "month") {
                  setCursor((v) => {
                    const next = new Date(v);
                    next.setMonth(next.getMonth() + direction);
                    return next;
                  });
                } else {
                  setCursor((v) => addDays(v, direction * (view === "week" ? 7 : 1)));
                  if (view === "day") setSelectedDate((prev) => shiftDateKey(prev, direction));
                }
              }}
              className="p-2"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10rem] text-center text-sm font-medium">{headerLabel}</div>
            <Button
              variant="ghost"
              onClick={() => {
                const direction = 1;
                if (view === "month") {
                  setCursor((v) => {
                    const next = new Date(v);
                    next.setMonth(next.getMonth() + direction);
                    return next;
                  });
                } else {
                  setCursor((v) => addDays(v, direction * (view === "week" ? 7 : 1)));
                  if (view === "day") setSelectedDate((prev) => shiftDateKey(prev, direction));
                }
              }}
              className="p-2"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Month view ── */}
      {view === "month" && (
        <Card>
          <div className="grid grid-cols-7 gap-2 text-xs uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            {weekdayLabels(weekStartsOn).map((label) => (
              <div key={label} className="py-1 text-center">
                {label}
              </div>
            ))}
          </div>

          {monthQuery.isLoading ? (
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthCells.map((cell) => {
                const isToday = cell.date === todayStr;
                const isSelected = cell.date === selectedDate;
                const isFuture = cell.date > todayStr;
                const isPerfect = cell.data.completionRate === 100 && cell.data.assigned >= 1;
                const isMissed = cell.data.completionRate === 0 && cell.data.assigned >= 1;

                const categoryIds = Object.keys(cell.data.categories ?? {}).slice(0, 3);

                const cellStyle = isPerfect
                  ? "border-[var(--accent)] bg-[var(--accent)]"
                  : isMissed
                    ? "border-[var(--danger)] bg-[rgba(239,68,68,0.08)]"
                    : isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-muted)] shadow-[var(--shadow-sm)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface-1)]";

                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => {
                      if (!cell.inMonth) {
                        setCursor(new Date(`${cell.date}T12:00:00`));
                        return;
                      }
                      setSelectedDate(cell.date);
                      setCursor(new Date(`${cell.date}T12:00:00`));
                      if (isFuture) {
                        setQuickAdd(true, cell.date, false);
                      } else {
                        setActivePanel({ type: "day", date: cell.date });
                      }
                    }}
                    aria-label={`${cell.date}${isPerfect ? ", perfect day" : ""}${isMissed ? ", missed day" : ""}`}
                    style={isToday ? { boxShadow: "0 0 0 2px var(--accent)" } : undefined}
                    className={cn(
                      "relative aspect-square rounded-[var(--radius-md)] border p-2 text-left transition",
                      !cell.inMonth && "opacity-35",
                      cell.inMonth && !isPerfect && "hover:bg-[var(--bg-surface-2)]",
                      cellStyle,
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isPerfect ? "text-black" : isToday ? "text-[var(--accent)]" : isFuture && !isSelected ? "text-[var(--text-tertiary)]" : "",
                        )}
                      >
                        {cell.dayNum}
                      </span>
                      {isPerfect && !isFuture && (
                        <Check className="h-3.5 w-3.5 text-black" />
                      )}
                      {isMissed && !isFuture && (
                        <Minus className="h-3.5 w-3.5 text-[var(--danger)]" />
                      )}
                    </div>

                    {!isPerfect && cell.data.assigned > 0 && (
                      <div className="mt-1.5 h-1 rounded-full bg-[var(--bg-surface-3)]">
                        <div
                          className={cn("h-1 rounded-full", isMissed ? "bg-[var(--danger)]" : "bg-[var(--accent)]")}
                          style={{
                            width: `${Math.max(cell.data.completionRate, 6)}%`,
                          }}
                        />
                      </div>
                    )}

                    {categoryIds.length > 0 && !isPerfect && (
                      <div className="mt-1.5 flex gap-1">
                        {categoryIds.map((categoryId) => (
                          <span
                            key={categoryId}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: categoryColors.get(categoryId) ?? "var(--accent)" }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">M</kbd> Month ·{" "}
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">W</kbd> Week ·{" "}
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">D</kbd> Day ·{" "}
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">T</kbd> Today ·{" "}
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">←/→</kbd> navigate ·{" "}
            <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">Q</kbd> Quick Add
          </p>
        </Card>
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <Card>
          <div className="flex gap-2">
            {weekDates.map((date) => (
              <WeekDayColumn key={date} date={date} weekStartsOn={weekStartsOn} />
            ))}
          </div>
          <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
            Click a day header to open its detail panel. <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">←/→</kbd> moves by week.
          </p>
        </Card>
      )}

      {/* ── Day view ── */}
      {view === "day" && (
        <Card className="p-0">
          <DayDetailContent
            key={selectedDate}
            date={selectedDate}
            onAddTask={() => setQuickAdd(true, selectedDate, selectedDate < todayStr)}
          />
        </Card>
      )}
    </div>
  );
}

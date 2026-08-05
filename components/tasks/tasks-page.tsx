"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { useCreateTaskMutation, useToggleTaskMutation } from "@/hooks/useTaskMutations";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useUiStore } from "@/stores/uiStore";

import { TaskPanel } from "./task-panel";
import { DurationPromptDialog } from "./duration-prompt";

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Task = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  priority: Priority | null;
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  isBackfilled: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; color: string; icon: string; isArchived: boolean };
  tags: Array<{ tag: { id: string; name: string } }>;
};

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isArchived: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// Text + border color classes for priority badges on task rows
const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: "text-[var(--text-tertiary)] border-[var(--border-default)]",
  MEDIUM: "text-[var(--info)] border-[var(--info)]",
  HIGH: "text-[var(--warning)] border-[var(--warning)]",
  URGENT: "text-[var(--danger)] border-[var(--danger)]",
};

// Active / inactive styles for priority filter chips
const PRIORITY_CHIP_ACTIVE: Record<Priority, string> = {
  LOW: "border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--bg-surface-2)]",
  MEDIUM: "border-[var(--info)] text-[var(--info)]",
  HIGH: "border-[var(--warning)] text-[var(--warning)]",
  URGENT: "border-[var(--danger)] text-[var(--danger)]",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function isOverdue(dueDate: string | null, completedAt: string | null): boolean {
  if (!dueDate || completedAt) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(dueDate) < startOfToday;
}

function formatDueDate(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onClick: () => void;
}

function TaskRow({ task, onToggle, onClick }: TaskRowProps) {
  const isComplete = !!task.completedAt;
  const overdue = isOverdue(task.dueDate, task.completedAt);
  const visibleTags = task.tags.slice(0, 3);
  const extraTagCount = task.tags.length - visibleTags.length;

  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-3 transition hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-2)]"
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0 text-[var(--text-tertiary)] transition hover:text-[var(--accent)]"
      >
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Title */}
      <span
        className={`flex-1 truncate text-sm ${
          isComplete
            ? "text-[var(--text-tertiary)] line-through"
            : "text-[var(--text-primary)]"
        }`}
      >
        {task.title}
      </span>

      {/* Category dot + name */}
      <span className="hidden shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)] sm:flex">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: task.category.color }}
        />
        {task.category.name}
      </span>

      {/* Priority badge */}
      {task.priority && (
        <span
          className={`hidden shrink-0 rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide md:block ${PRIORITY_BADGE[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      )}

      {/* Due date */}
      {task.dueDate && (
        <span
          className={`shrink-0 text-xs ${
            overdue ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
          }`}
        >
          {formatDueDate(task.dueDate)}
        </span>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 lg:flex">
          {visibleTags.map(({ tag }) => (
            <span
              key={tag.id}
              className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
              {tag.name}
            </span>
          ))}
          {extraTagCount > 0 && (
            <span className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
              +{extraTagCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TasksPage ────────────────────────────────────────────────────────────────

export function TasksPage() {
  // ── Filter state (synced to URL) ──
  const [status, setStatus] = useState(() => {
    if (typeof window === "undefined") return "all";
    const raw = new URLSearchParams(window.location.search).get("status");
    return raw === "incomplete" || raw === "completed" ? raw : "all";
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = new URLSearchParams(window.location.search).get("category");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [selectedPriorities, setSelectedPriorities] = useState<Priority[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = new URLSearchParams(window.location.search).get("priority");
    if (!raw) return [];
    return raw
      .split(",")
      .filter((p): p is Priority =>
        PRIORITIES.includes(p as Priority),
      );
  });
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const debouncedSearch = useDebounce(search, 300);

  // Write filters back to the URL so they survive reloads and are shareable
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (status !== "all") params.set("status", status);
    else params.delete("status");
    if (selectedCategories.length > 0)
      params.set("category", selectedCategories.join(","));
    else params.delete("category");
    if (selectedPriorities.length > 0)
      params.set("priority", selectedPriorities.join(","));
    else params.delete("priority");
    if (debouncedSearch) params.set("q", debouncedSearch);
    else params.delete("q");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [status, selectedCategories, selectedPriorities, debouncedSearch]);

  // ── Quick-add form state ──
  const [quickTitle, setQuickTitle] = useState("");
  const [quickCategoryId, setQuickCategoryId] = useState("");
  const [quickPriority, setQuickPriority] = useState("");
  const [quickDueDate, setQuickDueDate] = useState("");

  // ── Completed section collapse ──
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // ── Actual-duration prompt ──
  const [durationPromptTask, setDurationPromptTask] = useState<Task | null>(null);

  // ── Category dropdown state ──
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // ── Store ──
  const setActivePanel = useUiStore((state) => state.setActivePanel);

  // ── Data ──
  const categoriesQuery = useCategoriesQuery(false);
  const categoryList = (categoriesQuery.data ?? []) as Category[];

  const toggleTask = useToggleTaskMutation();
  const createTask = useCreateTaskMutation();

  const filterParams: Record<string, string | undefined> = {
    status,
    category: selectedCategories.length > 0 ? selectedCategories.join(",") : undefined,
    priority: selectedPriorities.length > 0 ? selectedPriorities.join(",") : undefined,
    search: debouncedSearch || undefined,
  };
  const tasksQuery = useTasksQuery(filterParams);
  const tasksData = tasksQuery.data as { items: Task[]; total: number } | undefined;
  const items = tasksData?.items ?? [];

  const incomplete = status === "all" ? items.filter((t) => !t.completedAt) : items;
  const completed = status === "all" ? items.filter((t) => !!t.completedAt) : [];

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedPriorities.length > 0 || !!debouncedSearch;

  // ── Close category dropdown on outside click ──
  useEffect(() => {
    if (!categoryDropdownOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [categoryDropdownOpen]);

  // ── Filter helpers ──
  function clearFilters() {
    setSelectedCategories([]);
    setSelectedPriorities([]);
    setSearch("");
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function togglePriority(p: Priority) {
    setSelectedPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  // ── Toggle with actual-duration prompt ──

  function handleToggleTask(task: Task) {
    const completing = !task.completedAt;
    if (
      completing &&
      task.estimatedDurationMinutes != null &&
      task.actualDurationMinutes == null
    ) {
      setDurationPromptTask(task);
      return;
    }
    toggleTask.mutate({ id: task.id, completed: completing });
  }

  function handleDurationConfirm(actualMinutes: number | null) {
    const task = durationPromptTask;
    setDurationPromptTask(null);
    if (!task) return;
    toggleTask.mutate({
      id: task.id,
      completed: true,
      actualDurationMinutes: actualMinutes,
    });
  }

  // ── Quick-add handler ──
  async function handleCreateTask() {
    if (!quickTitle.trim() || !quickCategoryId) return;
    await createTask.mutateAsync({
      title: quickTitle.trim(),
      categoryId: quickCategoryId,
      ...(quickPriority ? { priority: quickPriority } : {}),
      ...(quickDueDate ? { dueDate: new Date(quickDueDate).toISOString() } : {}),
    });
    setQuickTitle("");
    setQuickDueDate("");
  }

  // ── Render ──

  const taskCountLabel = tasksQuery.isLoading
    ? "Loading…"
    : `${items.length} task${items.length !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-4">
      {/* ── Header + filters + quick-add ── */}
      <Card className="space-y-4">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Track today, overdue, and historical work from one list.
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status segmented control */}
          <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)]">
            {(["all", "incomplete", "completed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 text-sm capitalize transition ${
                  status === s
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Category multi-select dropdown */}
          <div ref={categoryDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-2)]"
            >
              {selectedCategories.length > 0
                ? `${selectedCategories.length} categor${selectedCategories.length === 1 ? "y" : "ies"}`
                : "Category"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-2)] p-1 shadow-[var(--shadow-md)]">
                {categoryList.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-[var(--text-tertiary)]">
                    No categories yet.
                  </p>
                ) : (
                  categoryList.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 transition hover:bg-[var(--bg-surface-3)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        className="accent-[var(--accent)]"
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-sm text-[var(--text-primary)]">
                        {cat.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Priority filter chips */}
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => {
              const active = selectedPriorities.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={`rounded-[var(--radius-sm)] border px-2 py-1 text-xs transition ${
                    active
                      ? PRIORITY_CHIP_ACTIVE[p]
                      : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--border-default)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative min-w-[160px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8"
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex shrink-0 items-center gap-1 text-sm text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* ── Quick-add form ── */}
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Quick Add
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateTask();
              }}
              placeholder="Task title"
              className="min-w-[200px] flex-1"
            />
            <Select
              value={quickCategoryId}
              onChange={(e) => setQuickCategoryId(e.target.value)}
              className="w-40"
            >
              <option value="">Category</option>
              {categoryList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            <Select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value)}
              className="w-36"
            >
              <option value="">Priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="w-40"
            />
            <Button
              onClick={() => void handleCreateTask()}
              disabled={!quickTitle.trim() || !quickCategoryId || createTask.isPending}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {createTask.isPending ? "Adding…" : "Add Task"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Task list ── */}
      <div className="space-y-1">
        {/* Count label */}
        <p className="px-1 pb-1 text-xs text-[var(--text-tertiary)]">{taskCountLabel}</p>

        {tasksQuery.isLoading ? (
          /* Loading skeletons */
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <EmptyState
            title="No tasks"
            description={
              hasActiveFilters
                ? "No tasks match your current filters. Try adjusting or clearing them."
                : "Create your first task using the Quick Add form above."
            }
          />
        ) : (
          <>
            {/* ── Incomplete tasks ── */}
            {status !== "completed" && (
              <div className="space-y-1">
                {(status === "all" ? incomplete : items).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task)}
                    onClick={() => setActivePanel({ type: "task", id: task.id })}
                  />
                ))}
              </div>
            )}

            {/* ── Completed tasks (status=all, collapsible) ── */}
            {status === "all" && completed.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setCompletedExpanded((prev) => !prev)}
                  className="flex items-center gap-2 px-1 py-1.5 text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                >
                  {completedExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Completed ({completed.length})
                </button>

                {completedExpanded && (
                  <div className="mt-1 space-y-1">
                    {completed.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onToggle={() => handleToggleTask(task)}
                        onClick={() => setActivePanel({ type: "task", id: task.id })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Completed tasks (status=completed, flat list) ── */}
            {status === "completed" && (
              <div className="space-y-1">
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggleTask(task)}
                    onClick={() => setActivePanel({ type: "task", id: task.id })}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Task detail slide-over panel */}
      <TaskPanel />

      {/* Actual-duration prompt when completing an estimated task */}
      {durationPromptTask && (
        <DurationPromptDialog
          taskTitle={durationPromptTask.title}
          estimatedMinutes={durationPromptTask.estimatedDurationMinutes ?? 0}
          onCancel={() => setDurationPromptTask(null)}
          onConfirm={handleDurationConfirm}
        />
      )}
    </div>
  );
}

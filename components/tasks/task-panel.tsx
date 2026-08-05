"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/hooks/use-api";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import {
  useDeleteTaskMutation,
  useToggleTaskMutation,
  useUpdateTaskMutation,
} from "@/hooks/useTaskMutations";
import { queryKeys } from "@/lib/query-keys";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useUiStore } from "@/stores/uiStore";

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

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dueDate: string | null, completedAt: string | null): boolean {
  if (!dueDate || completedAt) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(dueDate) < startOfToday;
}

// ─── TaskPanelContent ─────────────────────────────────────────────────────────

interface TaskPanelContentProps {
  taskId: string | undefined;
  onClose: () => void;
}

function TaskPanelContent({ taskId, onClose }: TaskPanelContentProps) {
  const updateTask = useUpdateTaskMutation();
  const deleteTask = useDeleteTaskMutation();
  const toggleTask = useToggleTaskMutation();

  const taskQuery = useQuery<Task>({
    queryKey: queryKeys.task(taskId ?? ""),
    queryFn: () => fetchJson<Task>(`/api/tasks/${taskId}`),
    enabled: !!taskId,
  });

  const task = taskQuery.data;

  const categoriesQuery = useCategoriesQuery(false);
  const categoryList = (categoriesQuery.data ?? []) as Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    isArchived: boolean;
  }>;

  // ── Local draft state ──
  // Drafts are seeded from task data when the user starts editing each field,
  // rather than in a useEffect, to avoid cascading renders (React 19).
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [editingDuration, setEditingDuration] = useState(false);
  const [draftDuration, setDraftDuration] = useState("");
  const [durationPrompt, setDurationPrompt] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus title input when it mounts
  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  // ── Handlers ──

  // ── Edit starters (seed draft from current task data) ──

  function startEditingTitle() {
    if (!task) return;
    setDraftTitle(task.title);
    setEditingTitle(true);
  }

  function startEditingDescription() {
    if (!task) return;
    setDraftDescription(task.description ?? "");
    setEditingDescription(true);
  }

  function startEditingNotes() {
    if (!task) return;
    setDraftNotes(task.notes ?? "");
    setEditingNotes(true);
  }

  function startEditingDuration() {
    if (!task) return;
    setDraftDuration(
      task.estimatedDurationMinutes != null ? String(task.estimatedDurationMinutes) : "",
    );
    setEditingDuration(true);
  }

  // ── Save handlers ──

  function saveTitle() {
    if (!task) return;
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate({ id: task.id, title: trimmed });
    }
    setEditingTitle(false);
  }

  function saveDescription() {
    if (!task) return;
    if (draftDescription !== (task.description ?? "")) {
      updateTask.mutate({ id: task.id, description: draftDescription || null });
    }
    setEditingDescription(false);
  }

  function saveNotes() {
    if (!task) return;
    if (draftNotes !== (task.notes ?? "")) {
      updateTask.mutate({ id: task.id, notes: draftNotes || null });
    }
    setEditingNotes(false);
  }

  function saveDuration() {
    if (!task) return;
    const trimmed = draftDuration.trim();
    const parsed = trimmed ? Number(trimmed) : null;
    const committed =
      task.estimatedDurationMinutes != null ? Number(task.estimatedDurationMinutes) : null;
    if (Number.isFinite(parsed) && (parsed === null || parsed >= 0) && parsed !== committed) {
      updateTask.mutate({ id: task.id, estimatedDurationMinutes: parsed });
    }
    setEditingDuration(false);
  }

  function handleToggle() {
    if (!task) return;
    const completing = !task.completedAt;
    if (
      completing &&
      task.estimatedDurationMinutes != null &&
      task.actualDurationMinutes == null
    ) {
      setDurationPrompt(true);
      return;
    }
    toggleTask.mutate({ id: task.id, completed: completing });
  }

  function handleDurationConfirm(actualMinutes: number | null) {
    setDurationPrompt(false);
    if (!task) return;
    toggleTask.mutate({
      id: task.id,
      completed: true,
      actualDurationMinutes: actualMinutes,
    });
  }

  function handleDelete() {
    if (!task) return;
    deleteTask.mutate(task.id, { onSuccess: () => onClose() });
  }

  // ── Render: loading ──

  if (!taskId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--text-tertiary)]">
        No task selected.
      </div>
    );
  }

  if (taskQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--text-secondary)]">
        Failed to load task.
      </div>
    );
  }

  const isComplete = !!task.completedAt;
  const overdue = isOverdue(task.dueDate, task.completedAt);

  // ── Render: content ──

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Header: title + toggle + close ── */}
      <div className="flex items-start gap-3 border-b border-[var(--border-subtle)] p-4">
        {/* Completion toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggleTask.isPending}
          aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
          className="mt-0.5 shrink-0 text-[var(--text-tertiary)] transition hover:text-[var(--accent)] disabled:opacity-50"
        >
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-[var(--accent)]" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>

        {/* Title */}
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                }
              }}
              className="text-base font-semibold"
            />
          ) : (
            <h2
              className={`cursor-pointer text-base font-semibold leading-snug transition hover:text-[var(--accent)] ${isComplete ? "opacity-50 line-through" : ""}`}
              onClick={startEditingTitle}
              title="Click to edit title"
            >
              {task.title}
            </h2>
          )}

          {isComplete && task.completedAt && (
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
              Completed {formatDate(task.completedAt)}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Metadata row (editable) ── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3">
        {/* Priority */}
        <Select
          value={task.priority ?? ""}
          onChange={(e) =>
            updateTask.mutate({ id: task.id, priority: e.target.value || null })
          }
          aria-label="Priority"
          className="h-8 w-28 text-xs"
        >
          <option value="">No priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>

        {/* Category */}
        <Select
          value={task.categoryId}
          onChange={(e) =>
            updateTask.mutate({ id: task.id, categoryId: e.target.value })
          }
          aria-label="Category"
          className="h-8 max-w-[160px] text-xs"
        >
          {categoryList.length === 0 && <option value="">No categories</option>}
          {categoryList.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>

        {/* Due date */}
        <Input
          type="date"
          value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
          onChange={(e) =>
            updateTask.mutate({
              id: task.id,
              dueDate: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            })
          }
          aria-label="Due date"
          className={`h-8 w-36 text-xs ${overdue ? "border-[var(--danger)]" : ""}`}
        />

        {/* Estimated / actual duration */}
        {editingDuration ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              value={draftDuration}
              onChange={(e) => setDraftDuration(e.target.value)}
              onBlur={saveDuration}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDuration();
                if (e.key === "Escape") setEditingDuration(false);
              }}
              className="h-8 w-20 text-xs"
              aria-label="Estimated duration in minutes"
              autoFocus
            />
            <span className="text-xs text-[var(--text-tertiary)]">m</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditingDuration}
            title="Click to edit estimated duration"
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {task.actualDurationMinutes != null
              ? `${task.actualDurationMinutes}m actual`
              : task.estimatedDurationMinutes != null
                ? `${task.estimatedDurationMinutes}m est.`
                : "Add duration"}
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Description */}
        <section>
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Description
          </h3>
          {editingDescription ? (
            <Textarea
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              onBlur={saveDescription}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingDescription(false);
                }
              }}
              placeholder="Add a description..."
              autoFocus
              className="min-h-[96px]"
            />
          ) : (
            <div
              className="min-h-[2.5rem] cursor-pointer rounded-[var(--radius-md)] border border-transparent p-2 text-sm transition hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-2)]"
              onClick={startEditingDescription}
              title="Click to edit"
            >
              {task.description ? (
                <span className="whitespace-pre-wrap text-[var(--text-primary)]">
                  {task.description}
                </span>
              ) : (
                <span className="text-[var(--text-tertiary)]">Add a description…</span>
              )}
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Notes
          </h3>
          {editingNotes ? (
            <Textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              onBlur={saveNotes}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingNotes(false);
                }
              }}
              placeholder="Add notes…"
              autoFocus
              className="min-h-[96px]"
            />
          ) : (
            <div
              className="min-h-[2.5rem] cursor-pointer rounded-[var(--radius-md)] border border-transparent p-2 text-sm transition hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-2)]"
              onClick={startEditingNotes}
              title="Click to edit"
            >
              {task.notes ? (
                <span className="whitespace-pre-wrap text-[var(--text-primary)]">
                  {task.notes}
                </span>
              ) : (
                <span className="text-[var(--text-tertiary)]">Add notes…</span>
              )}
            </div>
          )}
        </section>

        {/* Tags */}
        {task.tags.length > 0 && (
          <section>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {task.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                >
                  <Tag className="h-3 w-3" />
                  {tag.name}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer: timestamps + delete ── */}
      <div className="border-t border-[var(--border-subtle)] p-4">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
          <span>Created {formatDate(task.createdAt)}</span>
          <span>Updated {formatDate(task.updatedAt)}</span>
        </div>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={deleteTask.isPending}
          className="w-full gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {deleteTask.isPending ? "Deleting…" : "Delete task"}
        </Button>
      </div>

      {/* Actual-duration prompt when completing an estimated task */}
      {durationPrompt && (
        <DurationPromptDialog
          taskTitle={task.title}
          estimatedMinutes={task.estimatedDurationMinutes ?? 0}
          onCancel={() => setDurationPrompt(false)}
          onConfirm={handleDurationConfirm}
        />
      )}
    </div>
  );
}

// ─── TaskPanel (exported) ─────────────────────────────────────────────────────

export function TaskPanel() {
  const { activePanel, setActivePanel } = useUiStore();
  const panelRef = useFocusTrap<HTMLDivElement>(activePanel?.type === "task");

  const isOpen = activePanel?.type === "task";
  const taskId = activePanel?.type === "task" ? activePanel.id : undefined;

  function close() {
    setActivePanel(null);
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePanel(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setActivePanel]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Task detail"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-lg)] transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {isOpen && (
          <TaskPanelContent key={taskId} taskId={taskId} onClose={close} />
        )}
      </div>
    </>
  );
}

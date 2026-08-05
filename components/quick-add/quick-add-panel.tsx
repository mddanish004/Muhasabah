"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { useCreateTaskMutation } from "@/hooks/useTaskMutations";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useUiStore } from "@/stores/uiStore";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

function todayKeyLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isPast(dateKey: string | null): boolean {
  if (!dateKey) return false;
  return dateKey < todayKeyLocal();
}

// ─── Form (mounted fresh each time the panel opens) ───────────────────────────

function QuickAddForm({
  date,
  backfill,
  onDone,
}: {
  date: string | null;
  backfill: boolean;
  onDone: () => void;
}) {
  const categoriesQuery = useCategoriesQuery(false);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const createTask = useCreateTaskMutation();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(date ?? todayKeyLocal());
  const [priority, setPriority] = useState<Priority | "">("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [tags, setTags] = useState("");
  const [backfilled, setBackfilled] = useState(backfill || isPast(date));

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.setTimeout(() => titleRef.current?.focus(), 50);
  }, []);

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || !categoryId || createTask.isPending) return;

    const dueDateIso = dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null;
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 10);

    await createTask.mutateAsync({
      title: trimmed,
      categoryId,
      ...(dueDateIso ? { dueDate: dueDateIso } : {}),
      ...(priority ? { priority } : {}),
      ...(estimatedMinutes ? { estimatedDurationMinutes: Number(estimatedMinutes) } : {}),
      ...(tagList.length > 0 ? { tags: tagList } : {}),
      ...(backfilled ? { isBackfilled: true } : {}),
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar", "month"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar", "day"] }),
    ]);
    onDone();
  }

  const pastDate = isPast(dueDate);

  return (
    <>
      <div className="flex items-start justify-between border-b border-[var(--border-subtle)] p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
            Quick Add Task
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Press <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">Q</kbd> anywhere to open
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close panel"
          className="rounded-[var(--radius-sm)] p-1 text-[var(--text-tertiary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <label htmlFor="qa-title" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Title
          </label>
          <Input
            id="qa-title"
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit();
            }}
            placeholder="What needs doing?"
            maxLength={120}
          />
        </div>

        <div>
          <label htmlFor="qa-category" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Category
          </label>
          <Select id="qa-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="qa-due" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Due date
            </label>
            <Input id="qa-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qa-priority" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Priority
            </label>
            <Select id="qa-priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")}>
              <option value="">—</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
        </div>

        <div>
          <label htmlFor="qa-duration" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Estimated duration (minutes, optional)
          </label>
          <Input
            id="qa-duration"
            type="number"
            min={0}
            max={1440}
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
            placeholder="e.g. 45"
          />
        </div>

        <div>
          <label htmlFor="qa-tags" className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Tags (comma separated, optional)
          </label>
          <Input
            id="qa-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. deep-work, morning"
          />
        </div>

        {pastDate && (
          <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={backfilled}
              onChange={(e) => setBackfilled(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium text-[var(--text-primary)]">Backfill task</span>
              <span className="block text-xs text-[var(--text-secondary)]">
                This task is dated in the past ({dueDate}) and will be marked as backfilled.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-4">
        <Button
          onClick={() => void handleSubmit()}
          disabled={!title.trim() || !categoryId || createTask.isPending}
          className="w-full"
        >
          {createTask.isPending ? "Adding…" : "Add task"}
        </Button>
        <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
          <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">Enter</kbd> to save,{" "}
          <kbd className="rounded border border-[var(--border-subtle)] px-1 font-mono">Esc</kbd> to cancel
        </p>
      </div>
    </>
  );
}

// ─── Panel (mounts/unmounts the form with the open state) ─────────────────────

export function QuickAddPanel() {
  const { quickAddOpen, quickAddDate, quickAddBackfill, setQuickAdd, commandOpen } = useUiStore();

  // Global shortcut: Q opens Quick Add (unless typing or command palette open)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "q" && e.key !== "Q") return;
      if (commandOpen) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      setQuickAdd(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandOpen, setQuickAdd]);

  // Esc closes
  useEffect(() => {
    if (!quickAddOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setQuickAdd(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickAddOpen, setQuickAdd]);

  const panelRef = useFocusTrap<HTMLDivElement>(quickAddOpen);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${quickAddOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setQuickAdd(false)}
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick add task"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-lg)] transition-transform duration-200 ${quickAddOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {quickAddOpen && (
          <QuickAddForm
            key={`${quickAddDate ?? "none"}-${quickAddBackfill ? "bf" : "now"}`}
            date={quickAddDate}
            backfill={quickAddBackfill}
            onDone={() => setQuickAdd(false)}
          />
        )}
      </div>
    </>
  );
}

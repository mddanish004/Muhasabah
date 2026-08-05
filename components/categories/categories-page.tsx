"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { Flame, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryPanel } from "@/components/categories/category-panel";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { useUiStore } from "@/stores/uiStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
  };
};

// ─── Dynamic icon helper ──────────────────────────────────────────────────────

function CategoryIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const key = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const IconComp =
    (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[key] ??
    LucideIcons.FolderKanban;
  return <IconComp className={className} style={style} />;
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = "name" | "completionRate" | "totalTasks";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "completionRate", label: "Completion Rate" },
  { value: "totalTasks", label: "Task Count" },
  { value: "name", label: "Name" },
];

function sortCategories(categories: Category[], key: SortKey): Category[] {
  return [...categories].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "completionRate") return b.stats.completionRate - a.stats.completionRate;
    if (key === "totalTasks") return b.stats.totalTasks - a.stats.totalTasks;
    return 0;
  });
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  onEdit,
  onClick,
}: {
  category: Category;
  onEdit: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const { stats } = category;
  const rate = Math.round(stats.completionRate);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={[
        "group relative cursor-pointer rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-5 shadow-[var(--shadow-sm)]",
        "transition hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]",
        category.isArchived ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Edit button */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${category.name}`}
        className="absolute right-3 top-3 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-tertiary)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {/* Header row */}
      <div className="flex items-start gap-3 pr-6">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
          style={{ backgroundColor: category.color + "26" }}
        >
          <CategoryIcon name={category.icon} className="h-4.5 w-4.5" style={{ color: category.color } as React.CSSProperties} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate text-base font-semibold leading-snug">{category.name}</h3>
            {category.isArchived && (
              <Badge className="shrink-0 text-[10px]">Archived</Badge>
            )}
          </div>
          {category.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span>{stats.totalTasks} task{stats.totalTasks !== 1 ? "s" : ""}</span>
        <span className="text-[var(--text-tertiary)]">·</span>
        <span>{rate}% completion</span>
        {stats.currentStreak > 0 && (
          <>
            <span className="text-[var(--text-tertiary)]">·</span>
            <span className="flex items-center gap-1 text-[var(--warning)]">
              <Flame className="h-3 w-3" />
              {stats.currentStreak}d
            </span>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${rate}%`,
            backgroundColor: category.color,
          }}
        />
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CategoryCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-[var(--radius-md)]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="mt-3 h-1 w-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CategoriesPage() {
  const router = useRouter();
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const [sortKey, setSortKey] = useState<SortKey>("completionRate");
  const [showArchived, setShowArchived] = useState(false);

  // Open the edit panel when arriving with ?edit=<id> (from the detail page)
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get("edit");
    if (editId) setActivePanel({ type: "category", id: editId });
  }, [setActivePanel]);

  const { data, isLoading, isError } = useCategoriesQuery(true) as {
    data: Category[] | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  const allCategories = data ?? [];
  const archivedCount = allCategories.filter((c) => c.isArchived).length;

  const visible = useMemo(() => {
    const filtered = showArchived
      ? data ?? []
      : (data ?? []).filter((c) => !c.isArchived);
    return sortCategories(filtered, sortKey);
  }, [data, showArchived, sortKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Categories</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Organise your tasks into focused domains.
          </p>
        </div>
        <Button
          onClick={() => setActivePanel({ type: "category" })}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Controls */}
      {!isLoading && allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            Sort by
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-auto min-w-[160px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-surface-1)] px-4 py-3 text-sm text-[var(--danger)]">
          Failed to load categories. Please refresh the page.
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && allCategories.length === 0 && (
        <EmptyState
          title="No categories yet"
          description="Create your first category to start organising your tasks."
          action={
            <Button onClick={() => setActivePanel({ type: "category" })}>
              Create your first category
            </Button>
          }
        />
      )}

      {/* Grid */}
      {!isLoading && !isError && visible.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onClick={() => router.push(`/categories/${category.id}`)}
              onEdit={(e) => {
                e.stopPropagation();
                setActivePanel({ type: "category", id: category.id });
              }}
            />
          ))}
        </div>
      )}

      {/* Show/hide archived toggle */}
      {!isLoading && archivedCount > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm text-[var(--text-tertiary)] underline underline-offset-2 hover:text-[var(--text-secondary)] transition"
          >
            {showArchived
              ? `Hide archived (${archivedCount})`
              : `Show archived (${archivedCount})`}
          </button>
        </div>
      )}

      {/* Panel */}
      <CategoryPanel />
    </div>
  );
}

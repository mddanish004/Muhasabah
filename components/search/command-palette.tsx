"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Calendar,
  FolderPlus,
  Plus,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useUiStore } from "@/stores/uiStore";

import { fetchJson } from "@/hooks/use-api";

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchResult = {
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    category: { name: string };
  }>;
  categories: Array<{ id: string; name: string }>;
};

type RecentTask = { id: string; title: string; category: string };

type PaletteItem = {
  id: string;
  label: string;
  group: string;
  secondary?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENTS_KEY = "muhasabah:recent-tasks";

function readRecents(): RecentTask[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentTask[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fuzzyMatch(query: string, label: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/);
  const lower = label.toLowerCase();
  return tokens.every((token) => lower.includes(token));
}

// ─── Palette ──────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const commandOpen = useUiStore((state) => state.commandOpen);
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const setActivePanel = useUiStore((state) => state.setActivePanel);
  const setQuickAdd = useUiStore((state) => state.setQuickAdd);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<RecentTask[]>([]);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dialogRef = useFocusTrap<HTMLDivElement>(commandOpen);

  const search = useQuery<SearchResult>({
    queryKey: ["palette-search", query],
    queryFn: () =>
      fetchJson<SearchResult>(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: commandOpen && query.trim().length > 0,
  });

  // Open/close shortcuts + query reset on open
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/") {
        event.preventDefault();
        setQuery("");
        setActiveIndex(0);
        setRecents(readRecents());
        setCommandOpen(true);
      }
      if (event.key === "Escape" && commandOpen) setCommandOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [commandOpen, setCommandOpen]);

  function close() {
    setCommandOpen(false);
  }

  function go(path: string) {
    close();
    router.push(path);
  }

  function openTask(task: { id: string; title: string; category: { name: string } }) {
    const next = [
      { id: task.id, title: task.title, category: task.category.name },
      ...readRecents().filter((t) => t.id !== task.id),
    ].slice(0, 5);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // ignore quota/private-mode failures
    }
    setRecents(next);
    go(`/tasks/${task.id}`);
  }

  // ── Build item list ──
  const actions: PaletteItem[] = [
    {
      id: "action-new-task",
      label: "New Task",
      group: "Actions",
      icon: Plus,
      onClick: () => {
        close();
        setQuickAdd(true);
      },
    },
    {
      id: "action-new-category",
      label: "New Category",
      group: "Actions",
      icon: FolderPlus,
      onClick: () => {
        close();
        setActivePanel({ type: "category" });
      },
    },
    {
      id: "action-analytics",
      label: "Go to Analytics",
      group: "Actions",
      icon: TrendingUp,
      onClick: () => go("/analytics"),
    },
    {
      id: "action-calendar",
      label: "Go to Calendar",
      group: "Actions",
      icon: Calendar,
      onClick: () => go("/calendar"),
    },
    {
      id: "action-settings",
      label: "Go to Settings",
      group: "Actions",
      icon: Settings,
      onClick: () => go("/settings"),
    },
  ].filter((action) => fuzzyMatch(query, action.label));

  const tasks: PaletteItem[] = (search.data?.tasks ?? [])
    .filter((task) => task.title.toLowerCase().includes(query.trim().toLowerCase()))
    .map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      group: "Tasks",
      secondary: `${task.category.name}${task.dueDate ? ` · due ${new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`,
      onClick: () => openTask(task),
    }));

  const categories: PaletteItem[] = (search.data?.categories ?? []).map((category) => ({
    id: `category-${category.id}`,
    label: category.name,
    group: "Categories",
    secondary: "Category",
    onClick: () => go(`/categories/${category.id}`),
  }));

  const recentItems: PaletteItem[] = recents.map((recent) => ({
    id: `recent-${recent.id}`,
    label: recent.title,
    group: "Recent",
    secondary: recent.category,
    onClick: () => go(`/tasks/${recent.id}`),
  }));

  const items: PaletteItem[] = query.trim()
    ? [...actions, ...tasks, ...categories]
    : [...actions, ...recentItems];

  const groups = items.map((item) => item.group);
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  // Scroll the active item into view
  useEffect(() => {
    if (!commandOpen) return;
    itemRefs.current[clampedIndex]?.scrollIntoView({ block: "nearest" });
  }, [clampedIndex, commandOpen]);

  if (!commandOpen) return null;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      items[clampedIndex]?.onClick();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-20"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="flex max-h-[70vh] w-full max-w-2xl flex-col rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface-1)] p-4 shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, categories, actions…"
            className="pl-9"
            aria-label="Search"
          />
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-1 py-6 text-center text-sm text-[var(--text-secondary)]">
              No results for “{query.trim()}”.
            </div>
          ) : (
            items.map((item, index) => {
              const isActive = index === clampedIndex;
              const showHeader = index === 0 || groups[index] !== groups[index - 1];
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showHeader && (
                    <p className="px-1 pb-1 pt-2 text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)] first:pt-0">
                      {item.group}
                    </p>
                  )}
                  <div
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={item.onClick}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 transition ${
                      isActive
                        ? "bg-[var(--bg-surface-2)]"
                        : "hover:bg-[var(--bg-surface-2)]"
                    }`}
                  >
                    {Icon && (
                      <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-[var(--text-primary)]">
                        {item.label}
                      </div>
                      {item.secondary && (
                        <div className="truncate text-xs text-[var(--text-secondary)]">
                          {item.secondary}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

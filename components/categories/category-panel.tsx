"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  FolderKanban,
  Heart,
  Brain,
  BookOpen,
  Dumbbell,
  Home,
  Briefcase,
  DollarSign,
  Music,
  Coffee,
  Code,
  Globe,
  Star,
  Zap,
  Target,
  Leaf,
  Smile,
  Camera,
  Car,
  Gift,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/hooks/use-api";
import { useCategoriesQuery } from "@/hooks/useCategoriesQuery";
import { queryKeys } from "@/lib/query-keys";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useUiStore } from "@/stores/uiStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  "#F0555A",
  "#F5A623",
  "#F5D547",
  "#4ADE80",
  "#34D0BA",
  "#4AC0E0",
  "#5B9EF0",
  "#7B7FF0",
  "#A76BF0",
  "#E06BE0",
  "#F06BA8",
  "#C9A876",
  "#8A9A5B",
  "#6B8FA3",
  "#9B9B9B",
  "#E8E8E8",
];

const ICON_MAP = {
  "folder-kanban": FolderKanban,
  heart: Heart,
  brain: Brain,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  home: Home,
  briefcase: Briefcase,
  "dollar-sign": DollarSign,
  music: Music,
  coffee: Coffee,
  code: Code,
  globe: Globe,
  star: Star,
  zap: Zap,
  target: Target,
  leaf: Leaf,
  smile: Smile,
  camera: Camera,
  car: Car,
  gift: Gift,
} as const;

type IconName = keyof typeof ICON_MAP;
const ICON_NAMES = Object.keys(ICON_MAP) as IconName[];
const DESC_MAX = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  isArchived: boolean;
};

// ─── Small icon button ────────────────────────────────────────────────────────

function IconButton({
  name,
  selected,
  onClick,
}: {
  name: IconName;
  selected: boolean;
  onClick: () => void;
}) {
  const IconComp = ICON_MAP[name];
  return (
    <button
      type="button"
      title={name}
      onClick={onClick}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border transition",
        selected
          ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]"
          : "border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]",
      ].join(" ")}
    >
      <IconComp className="h-4 w-4" />
    </button>
  );
}

// ─── Form (inner) ─────────────────────────────────────────────────────────────
// Receives defaultValues so it can initialise state once on mount (no effect needed).

type FormDefaults = {
  name: string;
  color: string;
  icon: IconName;
  description: string;
  isArchived: boolean;
};

function CategoryForm({
  editId,
  defaults,
  onClose,
}: {
  editId: string | null;
  defaults: FormDefaults;
  onClose: () => void;
}) {
  const pushToast = useUiStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const [name, setName] = useState(defaults.name);
  const [color, setColor] = useState(defaults.color);
  const [icon, setIcon] = useState<IconName>(defaults.icon);
  const [description, setDescription] = useState(defaults.description);
  const isArchived = defaults.isArchived;
  const [iconSearch, setIconSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [hexDraft, setHexDraft] = useState(defaults.color);

  const { data: allCategories } = useCategoriesQuery(true);
  const nameTaken = (allCategories ?? [])
    .filter((cat) => cat.id !== editId)
    .some((cat) => cat.name.trim().toLowerCase() === name.trim().toLowerCase());

  function commitHex() {
    if (/^#[0-9a-fA-F]{6}$/.test(hexDraft)) setColor(hexDraft.toLowerCase());
  }

  const filteredIcons = iconSearch.trim()
    ? ICON_NAMES.filter((n) => n.includes(iconSearch.toLowerCase()))
    : ICON_NAMES;

  const SelectedIcon = ICON_MAP[icon];

  async function handleSave() {
    if (!name.trim() || nameTaken) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        color,
        icon,
        description: description.trim() || null,
      };
      if (editId) {
        await fetchJson(`/api/categories/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        pushToast({ title: "Category updated" });
      } else {
        await fetchJson("/api/categories", {
          method: "POST",
          body: JSON.stringify(body),
        });
        pushToast({ title: "Category created" });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
      onClose();
    } catch (err) {
      pushToast({
        title: editId ? "Failed to update category" : "Failed to create category",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!editId) return;
    setSaving(true);
    try {
      await fetchJson(`/api/categories/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !isArchived }),
      });
      pushToast({ title: isArchived ? "Category unarchived" : "Category archived" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
      onClose();
    } catch (err) {
      pushToast({
        title: "Failed to update category",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editId || confirmName.trim() !== name.trim()) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/categories/${editId}?cascade=true`, { method: "DELETE" });
      pushToast({ title: "Category deleted" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
      onClose();
    } catch (err) {
      pushToast({
        title: "Failed to delete category",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Panel header preview strip */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-6 pb-4 pt-1">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)]"
          style={{ backgroundColor: color + "33" }}
        >
          <SelectedIcon className="h-3.5 w-3.5" style={{ color }} />
        </span>
        <span className="truncate text-sm font-medium text-[var(--text-secondary)]">
          {name.trim() || (editId ? "Edit category" : "New category")}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Name <span className="text-[var(--danger)]">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Health &amp; Fitness"
            autoFocus
            className={nameTaken ? "border-[var(--danger)]" : ""}
          />
          {nameTaken && (
            <p className="text-xs text-[var(--danger)]">
              A category with this name already exists.
            </p>
          )}
        </div>

        {/* Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => {
                  setColor(hex);
                  setHexDraft(hex);
                }}
                className={[
                  "h-7 w-7 rounded-full border-2 transition",
                  color === hex
                    ? "scale-110 border-white"
                    : "border-transparent hover:scale-105",
                ].join(" ")}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitHex();
              }}
              placeholder="#4ADE80"
              className="w-32 text-xs uppercase"
              aria-label="Custom hex color"
            />
            <span className="text-xs text-[var(--text-tertiary)]">
              or enter a custom hex
            </span>
          </div>
        </div>

        {/* Icon */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
            Icon
          </label>
          <Input
            value={iconSearch}
            onChange={(e) => setIconSearch(e.target.value)}
            placeholder="Search icons&#8230;"
            className="mb-2"
          />
          <div className="flex flex-wrap gap-1.5">
            {filteredIcons.length > 0 ? (
              filteredIcons.map((n) => (
                <IconButton
                  key={n}
                  name={n}
                  selected={icon === n}
                  onClick={() => setIcon(n)}
                />
              ))
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">
                No icons match &ldquo;{iconSearch}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-widest text-[var(--text-tertiary)]">
              Description
            </label>
            <span
              className={[
                "text-xs tabular-nums",
                description.length > DESC_MAX
                  ? "text-[var(--danger)]"
                  : "text-[var(--text-tertiary)]",
              ].join(" ")}
            >
              {description.length}/{DESC_MAX}
            </span>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional &#8212; what does this category track?"
            rows={3}
            maxLength={DESC_MAX}
          />
        </div>

        {/* Archive toggle (edit only) */}
        {editId && (
          <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {isArchived ? "Category is archived" : "Archive category"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {isArchived
                  ? "Restore it to continue tracking tasks."
                  : "Hidden from active lists but data is preserved."}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleArchiveToggle}
              disabled={saving}
              className="ml-4 shrink-0"
            >
              {isArchived ? "Unarchive" : "Archive"}
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="space-y-2 border-t border-[var(--border-subtle)] px-6 py-4">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={!name.trim() || nameTaken || description.length > DESC_MAX || saving}
        >
          {saving ? "Saving\u2026" : editId ? "Save Changes" : "Create Category"}
        </Button>
        {editId && !confirmingDelete && (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting || saving}
          >
            {deleting ? "Deleting\u2026" : "Delete Category"}
          </Button>
        )}
        {editId && confirmingDelete && (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-surface-2)] p-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Type <span className="font-semibold text-[var(--text-primary)]">{name.trim()}</span>{" "}
              to confirm deletion. Its tasks will be permanently deleted.
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmName.trim() === name.trim()) {
                  void handleDelete();
                }
              }}
              placeholder="Type the category name"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void handleDelete()}
                disabled={
                  deleting ||
                  confirmName.trim() === "" ||
                  confirmName.trim() !== name.trim()
                }
              >
                {deleting ? "Deleting\u2026" : "Delete permanently"}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setConfirmingDelete(false);
                  setConfirmName("");
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Loading skeleton (shown while fetching existing category) ─────────────────

function FormSkeleton() {
  return (
    <div className="flex-1 space-y-6 px-6 py-5">
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-10" />
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-8" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-[var(--radius-md)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel (outer) ────────────────────────────────────────────────────────────

export function CategoryPanel() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const pushToast = useUiStore((s) => s.pushToast);
  const panelRef = useFocusTrap<HTMLElement>(activePanel?.type === "category");

  const isOpen = activePanel?.type === "category";
  const editId = isOpen && activePanel.id ? activePanel.id : null;

  // Fetch existing category data when editId is present.
  // We store the last fetched result and match it by id to avoid stale defaults.
  const [loadedCategory, setLoadedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchedId = useRef<string | null>(null);

  // Only fetch when editId actually changes. We never reset loadedCategory
  // synchronously inside the effect to avoid cascading renders; instead we
  // derive a matchedCategory below by comparing ids.
  useEffect(() => {
    if (!editId) return;
    if (lastFetchedId.current === editId) return;
    lastFetchedId.current = editId;
    setLoading(true);
    fetchJson<Category>(`/api/categories/${editId}`)
      .then((cat) => setLoadedCategory(cat))
      .catch(() => {
        pushToast({ title: "Failed to load category", variant: "error" });
        setActivePanel(null);
      })
      .finally(() => setLoading(false));
  }, [editId, pushToast, setActivePanel]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePanel(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setActivePanel]);

  // Only use fetched data when it actually corresponds to the current editId.
  const matchedCategory = loadedCategory?.id === editId ? loadedCategory : null;

  // "formKey" changes whenever the panel opens a different context,
  // causing CategoryForm to remount with fresh state.
  const formKey = editId ?? "create";

  const defaults: FormDefaults = matchedCategory
    ? {
        name: matchedCategory.name,
        color: matchedCategory.color,
        icon: (ICON_NAMES.includes(matchedCategory.icon as IconName)
          ? matchedCategory.icon
          : "folder-kanban") as IconName,
        description: matchedCategory.description ?? "",
        isArchived: matchedCategory.isArchived,
      }
    : {
        name: "",
        color: PALETTE[3],
        icon: "folder-kanban",
        description: "",
        isArchived: false,
      };

  const showForm = !editId || (!loading && matchedCategory !== null);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setActivePanel(null)}
        className={[
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        aria-hidden="true"
      />

      {/* Slide-over */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editId ? "Edit category" : "New category"}
        className={[
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-[var(--bg-surface-1)] shadow-[var(--shadow-lg)] transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="text-base font-semibold">
            {editId ? "Edit Category" : "New Category"}
          </h2>
          <button
            type="button"
            onClick={() => setActivePanel(null)}
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: loading or form */}
        {loading && <FormSkeleton />}
        {showForm && (
          <CategoryForm
            key={formKey}
            editId={editId}
            defaults={defaults}
            onClose={() => setActivePanel(null)}
          />
        )}
      </aside>
    </>
  );
}

import { create } from "zustand";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "error";
  action?: { label: string; onClick: () => void };
};

type PanelState =
  | { type: "task"; id?: string }
  | { type: "category"; id?: string }
  | { type: "day"; date?: string }
  | null;

type UiState = {
  commandOpen: boolean;
  activePanel: PanelState;
  collapsedSections: Record<string, boolean>;
  toasts: ToastItem[];
  quickAddOpen: boolean;
  quickAddDate: string | null;
  quickAddBackfill: boolean;
  setCommandOpen: (open: boolean) => void;
  setActivePanel: (panel: PanelState) => void;
  toggleSection: (key: string) => void;
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
  setQuickAdd: (open: boolean, date?: string | null, backfill?: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  activePanel: null,
  collapsedSections: {},
  toasts: [],
  quickAddOpen: false,
  quickAddDate: null,
  quickAddBackfill: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleSection: (key) =>
    set((state) => ({
      collapsedSections: {
        ...state.collapsedSections,
        [key]: !state.collapsedSections[key],
      },
    })),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { id: crypto.randomUUID(), ...toast }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  setQuickAdd: (open, date = null, backfill = false) =>
    set({ quickAddOpen: open, quickAddDate: date, quickAddBackfill: backfill }),
}));

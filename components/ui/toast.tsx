"use client";

import { useEffect } from "react";

import { useUiStore } from "@/stores/uiStore";

export function ToastViewport() {
  const { toasts, dismissToast } = useUiStore();

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => dismissToast(toast.id), 4000),
    );
    return () => timers.forEach(clearTimeout);
  }, [dismissToast, toasts]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-[var(--radius-md)] border p-4 shadow-[var(--shadow-md)] ${
            toast.variant === "error"
              ? "border-[var(--danger)] bg-[var(--bg-surface-1)]"
              : "border-[var(--border-default)] bg-[var(--bg-surface-1)]"
          }`}
        >
          <div className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</div>
          {toast.description ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{toast.description}</p>
          ) : null}
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                dismissToast(toast.id);
              }}
              className="mt-2 text-sm font-medium text-[var(--accent)] transition hover:underline"
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

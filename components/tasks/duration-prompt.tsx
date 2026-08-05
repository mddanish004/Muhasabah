"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface DurationPromptProps {
  taskTitle: string;
  estimatedMinutes: number;
  onCancel: () => void;
  onConfirm: (actualMinutes: number | null) => void;
}

export function DurationPromptDialog({
  taskTitle,
  estimatedMinutes,
  onCancel,
  onConfirm,
}: DurationPromptProps) {
  const [minutes, setMinutes] = useState(String(estimatedMinutes));
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const parsed = Number(minutes);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Log actual duration"
        className="relative w-full max-w-sm rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-1)] p-5 shadow-[var(--shadow-lg)]"
      >
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Log actual duration
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          How long did “{taskTitle}” actually take? Estimated:{" "}
          {estimatedMinutes}m.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Input
            ref={inputRef}
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && parsed > 0) onConfirm(parsed);
              if (e.key === "Escape") onCancel();
            }}
            className="w-28"
            aria-label="Actual duration in minutes"
          />
          <span className="text-sm text-[var(--text-tertiary)]">minutes</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={() => onConfirm(null)}>
            Skip
          </Button>
          <Button onClick={() => onConfirm(parsed)} disabled={!parsed || parsed <= 0}>
            Complete
          </Button>
        </div>
      </div>
    </div>
  );
}

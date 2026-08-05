import { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-default)] px-2 py-1 text-[11px] uppercase tracking-[0.04em] text-[var(--text-secondary)]",
        className,
      )}
      {...props}
    />
  );
}

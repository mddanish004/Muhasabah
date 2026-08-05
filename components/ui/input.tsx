import { forwardRef, InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition",
        "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
});

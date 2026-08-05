import { forwardRef, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition",
        "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]",
        className,
      )}
      {...props}
    />
  );
});

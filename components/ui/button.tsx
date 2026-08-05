import { ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-md)] border px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]",
        variant === "primary" && "border-[var(--accent)] bg-[var(--accent)] text-black hover:brightness-95",
        variant === "secondary" &&
          "border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-3)]",
        variant === "ghost" && "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
        variant === "danger" && "border-[var(--danger)] bg-[var(--danger)] text-white hover:brightness-95",
        props.disabled && "cursor-not-allowed opacity-60",
        className,
      )}
      {...props}
    />
  );
});

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, FileText, FolderKanban, Home, ListTodo, Settings, X } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/categories", label: "Categories", icon: FolderKanban },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-6",
        className,
      )}
    >
      {/* Close button — only rendered when onClose is provided (mobile drawer) */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 text-[var(--text-secondary)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div>
        <div className="text-2xl font-bold">Muhasabah</div>
      </div>

      <nav className="mt-8 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
                active
                  ? "border border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
